// Pure helpers for the team checklist fork editor, diff view, and print
// surface — no DB/framework imports, fully unit-testable, mirroring the
// convention in lib/checklists.ts. The actual fork/diff/reorder algorithms
// live in @roundzero/db's checklists/fork.ts and are reused as-is; this file
// only adds the write-path and formatting glue around them.

import type { ForkItemRow, ResolvedItem, UpstreamItem } from "@roundzero/db";

// Prisma row shapes (duck-typed rather than imported from @prisma/client, so
// this file stays framework/DB-free) → the domain shapes fork.ts operates
// on. Shared by the detail page, the diff page, the print page, and
// actions.ts so the mapping is written once.

export interface PrismaUpstreamItemLike {
  id: string;
  skillNodeId: string;
  sortOrder: number;
  action: string;
  why: string;
  commands: unknown;
  lessonSlug: string | null;
  caution: string | null;
}

export function toUpstreamItem(item: PrismaUpstreamItemLike): UpstreamItem {
  return {
    id: item.id,
    skillNodeId: item.skillNodeId,
    sortOrder: item.sortOrder,
    action: item.action,
    why: item.why,
    commands: item.commands as Record<string, string>,
    lessonSlug: item.lessonSlug,
    caution: item.caution,
  };
}

export interface PrismaForkItemRowLike {
  id: string;
  upstreamItemId: string | null;
  sortOrder: number;
  action: string | null;
  why: string | null;
  commands: unknown;
  removed: boolean;
}

export function toForkItemRow(row: PrismaForkItemRowLike): ForkItemRow {
  return {
    id: row.id,
    upstreamItemId: row.upstreamItemId,
    sortOrder: row.sortOrder,
    action: row.action,
    why: row.why,
    commands: (row.commands as Record<string, string> | null) ?? null,
    removed: row.removed,
  };
}

/**
 * The single chokepoint that enforces the null-means-inherit invariant for a
 * plain-text override: writing a value equal to upstream stores null rather
 * than a duplicate string, so the field keeps tracking upstream corrections
 * instead of silently pinning to text that happens to match today.
 */
export function overrideOrNull(value: string, upstreamValue: string): string | null {
  const trimmed = value.trim();
  return trimmed === upstreamValue.trim() ? null : trimmed;
}

/** Order-independent map equality, mirroring fork.ts's own (unexported)
 * sameCommands — jsonb round-trips don't preserve key order. Exported
 * because the commands editor needs the same check to tell "the server sent
 * a genuinely new value" apart from "the server re-sent an equal object with
 * a new reference", which a naive `!==` would get wrong on every render. */
export function sameCommandsMap(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key, i) => key === keysB[i] && a[key] === b[key]);
}

/**
 * The commands override applies to the WHOLE variant map, not one variant at
 * a time: a team editing one OS variant must still write every other
 * variant's current text alongside it, or those variants would vanish on
 * resolve (resolveFork falls back to upstream only when the whole field is
 * null). Equal-to-upstream still collapses to null, same rule as
 * overrideOrNull, compared order-independently like fork.ts's own
 * (unexported) sameCommands.
 */
export function commandsOverrideOrNull(
  map: Record<string, string>,
  upstreamMap: Record<string, string>,
): Record<string, string> | null {
  return sameCommandsMap(map, upstreamMap) ? null : map;
}

export interface CommandDraftEntry {
  key: string;
  value: string;
}

/** Form-field pairs (one per OS-variant row in the editor) → the map shape
 * fork.ts and Prisma expect. Blank keys are dropped — that's how the editor
 * lets a team remove a variant row before submitting. */
export function parseCommandsDraft(entries: CommandDraftEntry[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) continue;
    result[key] = entry.value.trim();
  }
  return result;
}

const originLabels: Record<ResolvedItem["origin"], string> = {
  upstream: "Inherited",
  edited: "Edited",
  "team-added": "Team-added",
};

export function originLabel(origin: ResolvedItem["origin"]): string {
  return originLabels[origin];
}

/** Shown when the signed-in viewer isn't on a team — the print route works
 * without one, but a blank team name/slug would be a placeholder void
 * (DESIGN.md). Never rendered for an actual team. */
export const NO_TEAM_NAME = "Unaffiliated";
export const NO_TEAM_SLUG = "no-team";

/**
 * The datasheet header's record ID — lets two printouts be told apart at a
 * glance. Built from the TEMPLATE's current version, not the fork's
 * sourceVersion: resolveFork merges every inherited field against current
 * upstream, so a fork made at v1 already prints v2-derived text once
 * upstream moves on. Pairs with versionLabel below, which is what actually
 * surfaces the fork's original sourceVersion when it differs.
 */
export function formatRecordId({
  templateId,
  version,
  teamSlug,
  date,
}: {
  templateId: string;
  version: number;
  teamSlug: string;
  date: Date;
}): string {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `RZ-${templateId.toUpperCase()}-V${version}-${teamSlug.toUpperCase()}-${datePart}`;
}

/**
 * "v2" when the fork is current (or there is no fork), "v2 · forked at v1"
 * when the template has moved on since the fork was made — the signal a
 * coach needs on a paper artifact: what you're holding may already include
 * upstream corrections beyond what you forked.
 */
export function versionLabel(currentVersion: number, forkSourceVersion: number | null): string {
  if (forkSourceVersion === null || forkSourceVersion === currentVersion) {
    return `v${currentVersion}`;
  }
  return `v${currentVersion} · forked at v${forkSourceVersion}`;
}
