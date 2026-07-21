// Pure diff of desired (YAML) forensics questions against existing (DB) rows.
// A ForensicsQuestion carries no per-question user data — progress is tracked
// per archetype (ForensicsProgress), not per question — so a dropped id is
// hard-deleted, same as ChecklistItem (DECISIONS 022), not soft-deprecated
// like SkillNode/DrillCard. The answer key itself (answer/accepts/case/
// technique/why) is never stored in the DB, so there is nothing to diff for
// it — only the client-safe row fields matter here.

import type { ForensicsQuestionRow } from "./parse";

export type ExistingForensicsQuestion = ForensicsQuestionRow;

export interface ForensicsSyncPlan {
  toCreate: ForensicsQuestionRow[];
  toUpdate: ForensicsQuestionRow[];
  toRemove: ExistingForensicsQuestion[];
  unchanged: ForensicsQuestionRow[];
}

function sameQuestion(desired: ForensicsQuestionRow, existing: ExistingForensicsQuestion): boolean {
  return (
    desired.archetype === existing.archetype &&
    desired.skillNodeId === existing.skillNodeId &&
    desired.prompt === existing.prompt &&
    desired.given === existing.given &&
    desired.sortOrder === existing.sortOrder
  );
}

export function reconcileForensics(
  desired: ForensicsQuestionRow[],
  existing: ExistingForensicsQuestion[],
): ForensicsSyncPlan {
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const desiredIds = new Set(desired.map((row) => row.id));

  const toCreate: ForensicsQuestionRow[] = [];
  const toUpdate: ForensicsQuestionRow[] = [];
  const unchanged: ForensicsQuestionRow[] = [];

  for (const row of desired) {
    const current = existingById.get(row.id);
    if (!current) {
      toCreate.push(row);
    } else if (sameQuestion(row, current)) {
      unchanged.push(row);
    } else {
      toUpdate.push(row);
    }
  }

  const toRemove = existing.filter((row) => !desiredIds.has(row.id));

  return { toCreate, toUpdate, toRemove, unchanged };
}
