// Pure diff of desired (YAML) quiz questions against existing (DB) rows.
// A QuizQuestion carries no per-question user data — progress is tracked per
// (quizId, category) via QuizProgress, not per question — so a dropped id is
// hard-deleted, same as ChecklistItem (DECISIONS 022) and ForensicsQuestion
// (DECISIONS 031), not soft-deprecated like SkillNode/DrillCard. The answer
// key itself (answer/accepts/case/technique/why) is never stored in the DB,
// so there is nothing to diff for it — only the client-safe row fields
// matter here.

import type { QuizQuestionRow } from "./parse";

export type ExistingQuizQuestion = QuizQuestionRow;

export interface QuizSyncPlan {
  toCreate: QuizQuestionRow[];
  toUpdate: QuizQuestionRow[];
  toRemove: ExistingQuizQuestion[];
  unchanged: QuizQuestionRow[];
}

function sameQuestion(desired: QuizQuestionRow, existing: ExistingQuizQuestion): boolean {
  return (
    desired.quizId === existing.quizId &&
    desired.category === existing.category &&
    desired.skillNodeId === existing.skillNodeId &&
    desired.prompt === existing.prompt &&
    desired.given === existing.given &&
    desired.sortOrder === existing.sortOrder
  );
}

export function reconcileQuiz(
  desired: QuizQuestionRow[],
  existing: ExistingQuizQuestion[],
): QuizSyncPlan {
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const desiredIds = new Set(desired.map((row) => row.id));

  const toCreate: QuizQuestionRow[] = [];
  const toUpdate: QuizQuestionRow[] = [];
  const unchanged: QuizQuestionRow[] = [];

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
