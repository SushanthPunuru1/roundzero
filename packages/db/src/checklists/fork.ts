// Pure fork + diff logic for team checklists (ROADMAP Milestone 2). No
// DB/framework access — apps/web loads the rows and calls these, exactly how
// track/generate.ts is wrapped by lib/track.ts.
//
// The data model carries everything this needs (TeamChecklist.sourceVersion,
// TeamChecklistItem.upstreamItemId / .removed / nullable overrides on
// action/why/commands, plus a nullable upstream-at-override-time snapshot
// per field), so this pure layer shipped with no migration for its own
// logic. Two later migrations DID touch the schema to keep it honest: one
// made TeamChecklistItem.action nullable to match why/commands, and one
// added the actionSnapshot/whySnapshot/commandsSnapshot columns diffFork
// needs — see docs/DECISIONS.md for both.
//
// Three ideas do all the work here:
//
// 1. A fork stores OVERRIDES, not copies. A forked item whose `action`/`why`/
//    `commands` are null inherits from upstream forever, so an upstream
//    wording fix keeps flowing to teams that never touched that item. Only
//    fields a team actually edited stop tracking upstream. This is why the
//    resolve step below exists rather than the fork being a flat snapshot.
//
// 2. Removal is a soft-hide (`removed: true`), never a delete. A team that
//    hides an item still has a row for it, so the diff can tell "this team
//    deliberately dropped it" apart from "upstream never had it" — and the
//    team can restore it. Deleting would lose that distinction permanently.
//
// 3. A conflict is upstream drift, not upstream disagreement. diffFork can't
//    tell "the team wrote different text on purpose" apart from "upstream
//    corrected this after the team overrode it" by comparing the override
//    against current upstream alone — both look identical that way, and the
//    first is the normal case, not an error state. Each override field
//    carries a snapshot of what upstream said the moment it was written, and
//    a conflict is snapshot != current upstream, not override != current
//    upstream. See diffFork's own doc comment below.

export interface UpstreamItem {
  id: string;
  skillNodeId: string;
  sortOrder: number;
  action: string;
  why: string;
  commands: Record<string, string>;
  lessonSlug: string | null;
  caution: string | null;
}

export interface ForkItemRow {
  id: string;
  upstreamItemId: string | null;
  sortOrder: number;
  /** Team override. Null on an upstream-backed item means "inherit". */
  action: string | null;
  why: string | null;
  commands: Record<string, string> | null;
  removed: boolean;
  /**
   * What upstream said for this field the moment its override was written.
   * This is diffFork's only source of truth for "did upstream change since
   * you overrode this" — comparing the override against CURRENT upstream
   * can't distinguish a deliberate customization (team wrote different text
   * on purpose; upstream never moved) from a stale one (upstream corrected
   * the field after the override was written). Null whenever the field
   * isn't overridden, or — for a row written before this column existed —
   * when there's no snapshot to compare: diffFork treats a missing snapshot
   * as "can't tell", never as a conflict.
   */
  actionSnapshot: string | null;
  whySnapshot: string | null;
  commandsSnapshot: Record<string, string> | null;
}

/** Where each field of a resolved row came from, so the UI can show a team
 * what it has actually changed without re-deriving it per field. */
export interface ResolvedItem {
  id: string;
  upstreamItemId: string | null;
  sortOrder: number;
  action: string;
  why: string;
  commands: Record<string, string>;
  lessonSlug: string | null;
  caution: string | null;
  origin: "upstream" | "edited" | "team-added";
  /** Field names this team has overridden. Empty for untouched/added items. */
  editedFields: ("action" | "why" | "commands")[];
  removed: boolean;
}

/**
 * Builds the item rows for a brand-new fork. Every upstream item gets a row
 * with NO overrides — a fresh fork is byte-identical to upstream when
 * resolved, and stays that way as upstream evolves until someone edits.
 */
export function initialForkItems(upstream: UpstreamItem[]): Omit<ForkItemRow, "id">[] {
  return [...upstream]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({
      upstreamItemId: item.id,
      sortOrder: index,
      action: null,
      why: null,
      commands: null,
      removed: false,
      actionSnapshot: null,
      whySnapshot: null,
      commandsSnapshot: null,
    }));
}

function sameCommands(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key, i) => key === keysB[i] && a[key] === b[key]);
}

/**
 * Merges a fork's rows with the current upstream template into what the team
 * actually sees. Team ordering wins; unedited fields fall through to
 * upstream; team-added items carry their own text.
 *
 * An upstream item RETIRED since the fork (its row survives but the template
 * no longer has it) is dropped rather than rendered with empty text — the
 * diff reports it as retired so the team learns why it vanished.
 */
export function resolveFork(fork: ForkItemRow[], upstream: UpstreamItem[]): ResolvedItem[] {
  const upstreamById = new Map(upstream.map((item) => [item.id, item]));

  const resolved: ResolvedItem[] = [];
  for (const row of fork) {
    if (row.upstreamItemId === null) {
      resolved.push({
        id: row.id,
        upstreamItemId: null,
        sortOrder: row.sortOrder,
        action: row.action ?? "",
        why: row.why ?? "",
        commands: row.commands ?? {},
        lessonSlug: null,
        caution: null,
        origin: "team-added",
        editedFields: [],
        removed: row.removed,
      });
      continue;
    }

    const source = upstreamById.get(row.upstreamItemId);
    if (!source) continue; // retired upstream — surfaced by diffFork, not rendered

    const editedFields: ResolvedItem["editedFields"] = [];
    if (row.action !== null && row.action !== source.action) editedFields.push("action");
    if (row.why !== null && row.why !== source.why) editedFields.push("why");
    if (row.commands !== null && !sameCommands(row.commands, source.commands)) {
      editedFields.push("commands");
    }

    resolved.push({
      id: row.id,
      upstreamItemId: source.id,
      sortOrder: row.sortOrder,
      action: row.action ?? source.action,
      why: row.why ?? source.why,
      commands: row.commands ?? source.commands,
      lessonSlug: source.lessonSlug,
      caution: source.caution,
      origin: editedFields.length > 0 ? "edited" : "upstream",
      editedFields,
      removed: row.removed,
    });
  }

  return resolved.sort((a, b) => a.sortOrder - b.sortOrder);
}

export interface ForkDiff {
  /** Upstream items added since the fork — the team has no row for them. */
  added: UpstreamItem[];
  /** Items whose upstream text changed underneath a team override — the team
   * is pinned to older wording and may want to look. This is the one that
   * matters and the only one that can quietly rot. */
  updatedConflicting: {
    item: UpstreamItem;
    fields: ("action" | "why" | "commands")[];
    teamValues: { action: string | null; why: string | null; commands: Record<string, string> | null };
  }[];
  /** Upstream items the team soft-removed. Not a problem — shown so a team
   * can see what it chose to drop, and restore it. */
  removedByTeam: UpstreamItem[];
  /** Items retired upstream that the fork still has a row for. */
  retiredUpstream: string[];
  /** Items this team wrote itself; upstream will never touch them. */
  teamAdded: number;
}

/**
 * Diffs a fork against the CURRENT upstream template.
 *
 * `sourceVersion` deliberately isn't consulted: it records which version was
 * forked, but the honest question a team asks is "what does upstream say
 * now versus what am I looking at", and that's answerable from the rows
 * themselves. Comparing versions alone would report a diff for a bumped
 * version with no substantive change.
 *
 * A conflict is NOT "override differs from current upstream" — that would
 * flag every deliberate customization forever, since a team's own wording is
 * *supposed* to differ from upstream. It is "upstream drifted since the
 * override was written": `row.actionSnapshot` (etc.) records what upstream
 * said the moment a field was overridden, and a conflict fires only when
 * that snapshot no longer matches current upstream. A missing snapshot
 * (field overridden, snapshot null — either a legacy row from before this
 * column existed, or nothing was ever recorded) reads as "can't tell", so it
 * is treated as an ordinary customization, never a false conflict.
 */
// There is deliberately no "upstream changed but you inherit it" category:
// an inheriting field has no stored override, so the team is ALREADY seeing
// the new text — there is nothing to report and nothing to act on.
export function diffFork(fork: ForkItemRow[], upstream: UpstreamItem[]): ForkDiff {
  const rowsByUpstreamId = new Map(
    fork.filter((r) => r.upstreamItemId !== null).map((r) => [r.upstreamItemId!, r]),
  );
  const upstreamById = new Map(upstream.map((i) => [i.id, i]));

  const added: UpstreamItem[] = [];
  const updatedConflicting: ForkDiff["updatedConflicting"] = [];
  const removedByTeam: UpstreamItem[] = [];

  for (const item of upstream) {
    const row = rowsByUpstreamId.get(item.id);
    if (!row) {
      added.push(item);
      continue;
    }
    if (row.removed) {
      removedByTeam.push(item);
      continue;
    }

    const conflicting: ("action" | "why" | "commands")[] = [];
    if (row.action !== null && row.actionSnapshot !== null && row.actionSnapshot !== item.action) {
      conflicting.push("action");
    }
    if (row.why !== null && row.whySnapshot !== null && row.whySnapshot !== item.why) {
      conflicting.push("why");
    }
    if (
      row.commands !== null &&
      row.commandsSnapshot !== null &&
      !sameCommands(row.commandsSnapshot, item.commands)
    ) {
      conflicting.push("commands");
    }

    if (conflicting.length > 0) {
      updatedConflicting.push({
        item,
        fields: conflicting,
        teamValues: { action: row.action, why: row.why, commands: row.commands },
      });
    }
  }

  const retiredUpstream = fork
    .filter((r) => r.upstreamItemId !== null && !upstreamById.has(r.upstreamItemId))
    .map((r) => r.upstreamItemId!);

  return {
    added,
    updatedConflicting,
    removedByTeam,
    retiredUpstream,
    teamAdded: fork.filter((r) => r.upstreamItemId === null && !r.removed).length,
  };
}

/** True when a team is looking at exactly upstream — used to decide whether
 * the diff view is worth offering at all. */
export function isCleanFork(diff: ForkDiff): boolean {
  return (
    diff.added.length === 0 &&
    diff.updatedConflicting.length === 0 &&
    diff.removedByTeam.length === 0 &&
    diff.retiredUpstream.length === 0 &&
    diff.teamAdded === 0
  );
}

/**
 * Moves one item to a new position and renumbers the whole list densely.
 * Returns every row whose sortOrder changed, so the caller writes the
 * minimum number of rows.
 *
 * Dense renumbering (rather than fractional/gap ordering) is deliberate: a
 * checklist is tens of items, reordered rarely, and read on paper under time
 * pressure. Contiguous 0..n-1 means the printed sheet can number items and
 * have those numbers mean something.
 */
export function reorder(
  items: { id: string; sortOrder: number }[],
  movedId: string,
  toIndex: number,
): { id: string; sortOrder: number }[] {
  const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const from = ordered.findIndex((i) => i.id === movedId);
  if (from === -1) return [];

  const clamped = Math.max(0, Math.min(toIndex, ordered.length - 1));
  if (clamped === from) return [];

  const [moved] = ordered.splice(from, 1);
  ordered.splice(clamped, 0, moved!);

  const changed: { id: string; sortOrder: number }[] = [];
  ordered.forEach((item, index) => {
    if (item.sortOrder !== index) changed.push({ id: item.id, sortOrder: index });
  });
  return changed;
}
