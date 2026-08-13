"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, Prisma, initialForkItems, reorder } from "@roundzero/db";

import { auth } from "@/lib/auth";
import { canEditTeamChecklist } from "@/lib/teams";
import {
  commandsOverrideOrNull,
  overrideOrNull,
  parseCommandsDraft,
  snapshotFor,
  toUpstreamItem,
} from "@/lib/checklist-fork";

export interface ChecklistActionState {
  error?: string;
}

const NOT_YOUR_CHECKLIST_ERROR = "That checklist isn't on your team.";
const EDIT_ROLE_ERROR = "Only a coach or captain can edit your team's checklist.";
const CHECK_FORM_ERROR = "Check the form and try again.";

async function requireSessionUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return session.user.id;
}

/**
 * The one authorization chokepoint every mutation below runs through:
 * session → same-org membership → coach/captain role. Checked here, not
 * just hidden in the UI — a member invoking the action directly still gets
 * refused (spec verification step 7).
 */
async function requireForkEditor(
  teamChecklistId: string,
): Promise<{ error: string } | { checklist: { id: string; organizationId: string; sourceId: string } }> {
  const userId = await requireSessionUserId();

  const checklist = await prisma.teamChecklist.findUnique({
    where: { id: teamChecklistId },
    select: { id: true, organizationId: true, sourceId: true },
  });
  if (!checklist) {
    return { error: NOT_YOUR_CHECKLIST_ERROR };
  }

  const member = await prisma.member.findFirst({
    where: { userId, organizationId: checklist.organizationId },
  });
  if (!member) {
    return { error: NOT_YOUR_CHECKLIST_ERROR };
  }
  if (!canEditTeamChecklist(member.role)) {
    return { error: EDIT_ROLE_ERROR };
  }

  return { checklist };
}

function revalidateChecklist(templateId: string) {
  revalidatePath(`/app/checklists/${templateId}`);
  revalidatePath(`/app/checklists/${templateId}/diff`);
  revalidatePath(`/app/checklists/${templateId}/print`);
}

const commandDraftEntrySchema = z.array(z.object({ key: z.string(), value: z.string() }));

function parseCommandEntriesField(raw: FormDataEntryValue | null): Record<string, string> | null {
  if (typeof raw !== "string") return {};
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = commandDraftEntrySchema.safeParse(json);
  if (!parsed.success) return null;
  return parseCommandsDraft(parsed.data);
}

// --- Fork creation -----------------------------------------------------------

const createForkSchema = z.object({ templateId: z.string().min(1) });

export async function createFork(
  _prevState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const userId = await requireSessionUserId();

  const parsed = createForkSchema.safeParse({ templateId: formData.get("templateId") });
  if (!parsed.success) {
    return { error: "That checklist doesn't exist." };
  }
  const { templateId } = parsed.data;

  const member = await prisma.member.findFirst({ where: { userId } });
  if (!member) {
    return { error: "Join a team before customizing a checklist." };
  }
  if (!canEditTeamChecklist(member.role)) {
    return { error: EDIT_ROLE_ERROR };
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) {
    return { error: "That checklist doesn't exist." };
  }

  // Idempotent: a double-click, or a race between two coaches on the same
  // team, shouldn't create a second fork.
  const existing = await prisma.teamChecklist.findFirst({
    where: { organizationId: member.organizationId, sourceId: templateId },
  });
  if (existing) {
    revalidateChecklist(templateId);
    return {};
  }

  const upstream = template.items.map(toUpstreamItem);
  const rows = initialForkItems(upstream);

  await prisma.teamChecklist.create({
    data: {
      organizationId: member.organizationId,
      sourceId: templateId,
      sourceVersion: template.version,
      title: template.title,
      items: {
        create: rows.map((row) => ({
          upstreamItemId: row.upstreamItemId,
          sortOrder: row.sortOrder,
          action: row.action ?? undefined,
          why: row.why ?? undefined,
          commands: row.commands ?? undefined,
          removed: row.removed,
        })),
      },
    },
  });

  revalidateChecklist(templateId);
  return {};
}

// --- Field edit ---------------------------------------------------------------

const updateTextSchema = z.object({
  teamChecklistId: z.string().min(1),
  itemId: z.string().min(1),
  field: z.enum(["action", "why"]),
  value: z.string().trim().min(1, "This field can't be empty."),
});

/**
 * Edits `action` or `why` on one item. A team-added item (no upstream row)
 * just stores the value — there's nothing to inherit. An upstream-linked
 * item runs the value through overrideOrNull, so text that happens to match
 * upstream writes null instead of a pointless duplicate.
 */
export async function updateForkItemText(
  _prevState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const parsed = updateTextSchema.safeParse({
    teamChecklistId: formData.get("teamChecklistId"),
    itemId: formData.get("itemId"),
    field: formData.get("field"),
    value: formData.get("value"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? CHECK_FORM_ERROR };
  }
  const { teamChecklistId, itemId, field, value } = parsed.data;

  const guard = await requireForkEditor(teamChecklistId);
  if ("error" in guard) return guard;

  const item = await prisma.teamChecklistItem.findUnique({ where: { id: itemId } });
  if (!item || item.teamChecklistId !== teamChecklistId) {
    return { error: "That item isn't part of this checklist." };
  }

  if (item.upstreamItemId === null) {
    await prisma.teamChecklistItem.update({
      where: { id: itemId },
      data: field === "action" ? { action: value } : { why: value },
    });
  } else {
    const upstreamItem = await prisma.checklistItem.findUnique({
      where: { id: item.upstreamItemId },
    });
    if (!upstreamItem) {
      return { error: "That item's upstream checklist entry was retired." };
    }
    const nextValue = overrideOrNull(value, upstreamItem[field]);
    const snapshot = snapshotFor(nextValue, upstreamItem[field]);
    await prisma.teamChecklistItem.update({
      where: { id: itemId },
      data:
        field === "action"
          ? { action: nextValue, actionSnapshot: snapshot }
          : { why: nextValue, whySnapshot: snapshot },
    });
  }

  revalidateChecklist(guard.checklist.sourceId);
  return {};
}

const updateCommandsSchema = z.object({
  teamChecklistId: z.string().min(1),
  itemId: z.string().min(1),
});

/**
 * Edits the WHOLE `commands` variant map at once — the caller must submit
 * every variant (edited and unedited together), never a partial map, or the
 * unedited variants would vanish on resolve. `entries` is a JSON-encoded
 * CommandDraftEntry[] from the editor's per-variant text rows.
 */
export async function updateForkItemCommands(
  _prevState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const parsed = updateCommandsSchema.safeParse({
    teamChecklistId: formData.get("teamChecklistId"),
    itemId: formData.get("itemId"),
  });
  if (!parsed.success) {
    return { error: CHECK_FORM_ERROR };
  }
  const { teamChecklistId, itemId } = parsed.data;

  const map = parseCommandEntriesField(formData.get("entries"));
  if (map === null) {
    return { error: "Check the commands and try again." };
  }
  if (Object.keys(map).length === 0) {
    return { error: "Add at least one command." };
  }

  const guard = await requireForkEditor(teamChecklistId);
  if ("error" in guard) return guard;

  const item = await prisma.teamChecklistItem.findUnique({ where: { id: itemId } });
  if (!item || item.teamChecklistId !== teamChecklistId) {
    return { error: "That item isn't part of this checklist." };
  }

  if (item.upstreamItemId === null) {
    await prisma.teamChecklistItem.update({ where: { id: itemId }, data: { commands: map } });
  } else {
    const upstreamItem = await prisma.checklistItem.findUnique({
      where: { id: item.upstreamItemId },
    });
    if (!upstreamItem) {
      return { error: "That item's upstream checklist entry was retired." };
    }
    const upstreamCommands = upstreamItem.commands as Record<string, string>;
    const nextValue = commandsOverrideOrNull(map, upstreamCommands);
    const snapshot = snapshotFor(nextValue, upstreamCommands);
    await prisma.teamChecklistItem.update({
      where: { id: itemId },
      data: {
        commands: nextValue ?? Prisma.DbNull,
        commandsSnapshot: snapshot ?? Prisma.DbNull,
      },
    });
  }

  revalidateChecklist(guard.checklist.sourceId);
  return {};
}

// --- Revert to upstream --------------------------------------------------------

const revertFieldSchema = z.object({
  teamChecklistId: z.string().min(1),
  itemId: z.string().min(1),
  field: z.enum(["action", "why", "commands"]),
});

/** Writes null for one field, restoring live inheritance from upstream.
 * Shared by the fork editor's "Revert to upstream" and the diff view's
 * "Accept upstream" — both are exactly this operation. */
export async function revertForkItemField(
  _prevState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const parsed = revertFieldSchema.safeParse({
    teamChecklistId: formData.get("teamChecklistId"),
    itemId: formData.get("itemId"),
    field: formData.get("field"),
  });
  if (!parsed.success) {
    return { error: CHECK_FORM_ERROR };
  }
  const { teamChecklistId, itemId, field } = parsed.data;

  const guard = await requireForkEditor(teamChecklistId);
  if ("error" in guard) return guard;

  const item = await prisma.teamChecklistItem.findUnique({ where: { id: itemId } });
  if (!item || item.teamChecklistId !== teamChecklistId) {
    return { error: "That item isn't part of this checklist." };
  }
  if (item.upstreamItemId === null) {
    return { error: "Team-added items have nothing to revert to." };
  }

  if (field === "commands") {
    await prisma.teamChecklistItem.update({
      where: { id: itemId },
      data: { commands: Prisma.DbNull, commandsSnapshot: Prisma.DbNull },
    });
  } else {
    await prisma.teamChecklistItem.update({
      where: { id: itemId },
      data:
        field === "action" ? { action: null, actionSnapshot: null } : { why: null, whySnapshot: null },
    });
  }

  revalidateChecklist(guard.checklist.sourceId);
  return {};
}

// --- Add items -----------------------------------------------------------------

const addItemSchema = z.object({
  teamChecklistId: z.string().min(1),
  action: z.string().trim().min(1, "Give the item an action."),
  why: z.string().trim().min(1, "Give the item a why."),
});

/** Adds a team-authored item (upstreamItemId: null) at the end of the
 * visible list. Upstream will never touch it. */
export async function addForkItem(
  _prevState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const parsed = addItemSchema.safeParse({
    teamChecklistId: formData.get("teamChecklistId"),
    action: formData.get("action"),
    why: formData.get("why"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? CHECK_FORM_ERROR };
  }

  const map = parseCommandEntriesField(formData.get("entries"));
  if (map === null) {
    return { error: "Check the commands and try again." };
  }

  const guard = await requireForkEditor(parsed.data.teamChecklistId);
  if ("error" in guard) return guard;

  const visibleCount = await prisma.teamChecklistItem.count({
    where: { teamChecklistId: parsed.data.teamChecklistId, removed: false },
  });

  await prisma.teamChecklistItem.create({
    data: {
      teamChecklistId: parsed.data.teamChecklistId,
      upstreamItemId: null,
      sortOrder: visibleCount,
      action: parsed.data.action,
      why: parsed.data.why,
      commands: Object.keys(map).length > 0 ? map : undefined,
      removed: false,
    },
  });

  revalidateChecklist(guard.checklist.sourceId);
  return {};
}

const addUpstreamSchema = z.object({
  teamChecklistId: z.string().min(1),
  upstreamItemId: z.string().min(1),
});

/** Diff view's "Add to our checklist" for an upstream item the fork has
 * never seen. If a (soft-removed) row already exists for it, restores that
 * row instead of creating a duplicate. */
export async function addUpstreamItemToFork(
  _prevState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const parsed = addUpstreamSchema.safeParse({
    teamChecklistId: formData.get("teamChecklistId"),
    upstreamItemId: formData.get("upstreamItemId"),
  });
  if (!parsed.success) {
    return { error: CHECK_FORM_ERROR };
  }
  const { teamChecklistId, upstreamItemId } = parsed.data;

  const guard = await requireForkEditor(teamChecklistId);
  if ("error" in guard) return guard;

  const existingRow = await prisma.teamChecklistItem.findFirst({
    where: { teamChecklistId, upstreamItemId },
  });
  if (existingRow) {
    if (existingRow.removed) {
      await prisma.teamChecklistItem.update({ where: { id: existingRow.id }, data: { removed: false } });
    }
    revalidateChecklist(guard.checklist.sourceId);
    return {};
  }

  const upstreamItem = await prisma.checklistItem.findUnique({ where: { id: upstreamItemId } });
  if (!upstreamItem || upstreamItem.templateId !== guard.checklist.sourceId) {
    return { error: "That item isn't part of this checklist's template." };
  }

  const visibleCount = await prisma.teamChecklistItem.count({
    where: { teamChecklistId, removed: false },
  });

  await prisma.teamChecklistItem.create({
    data: {
      teamChecklistId,
      upstreamItemId: upstreamItem.id,
      sortOrder: visibleCount,
      removed: false,
    },
  });

  revalidateChecklist(guard.checklist.sourceId);
  return {};
}

// --- Remove / restore ------------------------------------------------------------

const setRemovedSchema = z.object({
  teamChecklistId: z.string().min(1),
  itemId: z.string().min(1),
  removed: z.enum(["true", "false"]),
});

export async function setForkItemRemoved(
  _prevState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const parsed = setRemovedSchema.safeParse({
    teamChecklistId: formData.get("teamChecklistId"),
    itemId: formData.get("itemId"),
    removed: formData.get("removed"),
  });
  if (!parsed.success) {
    return { error: CHECK_FORM_ERROR };
  }
  const { teamChecklistId, itemId, removed } = parsed.data;

  const guard = await requireForkEditor(teamChecklistId);
  if ("error" in guard) return guard;

  const item = await prisma.teamChecklistItem.findUnique({ where: { id: itemId } });
  if (!item || item.teamChecklistId !== teamChecklistId) {
    return { error: "That item isn't part of this checklist." };
  }

  await prisma.teamChecklistItem.update({
    where: { id: itemId },
    data: { removed: removed === "true" },
  });

  revalidateChecklist(guard.checklist.sourceId);
  return {};
}

// --- Reorder -----------------------------------------------------------------------

const moveItemSchema = z.object({
  teamChecklistId: z.string().min(1),
  itemId: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

/** Keyboard-operable move-up/move-down (Chromebook-first — drag alone isn't
 * acceptable). Only the visible (non-removed) set participates: a removed
 * item keeps whatever sortOrder it had when hidden, which is fine, since
 * display/print numbering is always the item's position in this filtered
 * list, never the raw sortOrder value. That also means a restored item
 * lands by the [sortOrder, id] tie-break, not necessarily next to its old
 * neighbours — deterministic, not a promised position. */
export async function moveForkItem(
  _prevState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const parsed = moveItemSchema.safeParse({
    teamChecklistId: formData.get("teamChecklistId"),
    itemId: formData.get("itemId"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) {
    return { error: CHECK_FORM_ERROR };
  }
  const { teamChecklistId, itemId, direction } = parsed.data;

  const guard = await requireForkEditor(teamChecklistId);
  if ("error" in guard) return guard;

  const visibleRows = await prisma.teamChecklistItem.findMany({
    where: { teamChecklistId, removed: false },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, sortOrder: true },
  });

  const currentIndex = visibleRows.findIndex((row) => row.id === itemId);
  if (currentIndex === -1) {
    return { error: "That item isn't part of this checklist." };
  }
  const toIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  const changed = reorder(visibleRows, itemId, toIndex);
  if (changed.length === 0) return {};

  await prisma.$transaction(
    changed.map((row) =>
      prisma.teamChecklistItem.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder } }),
    ),
  );

  revalidateChecklist(guard.checklist.sourceId);
  return {};
}
