// Pure grading for a lesson's end-of-lesson check. No DB/framework imports.

import type { CheckQuestion } from "./parse";

export interface GradeResult {
  correct: number;
  total: number;
  score: number; // 0-100, rounded
  results: boolean[]; // per-question correctness, same order as `check`
}

export function gradeCheck(check: CheckQuestion[], answers: number[]): GradeResult {
  if (answers.length !== check.length) {
    throw new RangeError(`expected ${check.length} answers, got ${answers.length}`);
  }
  const results = check.map((question, index) => answers[index] === question.answer);
  const correct = results.filter(Boolean).length;
  const total = check.length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, score, results };
}

/** Retakes are allowed; the persisted score is always the best attempt. */
export function bestScore(previous: number | null | undefined, next: number): number {
  return previous == null ? next : Math.max(previous, next);
}
