// Pure diff of desired (MDX frontmatter) lesson rows against existing (DB)
// rows. Lessons have no deprecation concept (unlike SkillNode, DECISIONS 006)
// — content-as-code only adds/updates rows here; a lesson pulled from the
// content package simply stops being touched by sync.

import type { LessonRow } from "./parse";

export type { LessonRow };
export type ExistingLessonRow = LessonRow;

export interface LessonSyncPlan {
  toCreate: LessonRow[];
  toUpdate: LessonRow[];
  unchanged: LessonRow[];
}

function sameSkillSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, index) => id === sortedB[index]);
}

function sameLesson(desired: LessonRow, existing: ExistingLessonRow): boolean {
  return (
    desired.title === existing.title &&
    desired.domainId === existing.domainId &&
    desired.level === existing.level &&
    desired.minutes === existing.minutes &&
    desired.published === existing.published &&
    desired.sortOrder === existing.sortOrder &&
    sameSkillSet(desired.skills, existing.skills)
  );
}

export function reconcileLessons(
  desired: LessonRow[],
  existing: ExistingLessonRow[],
): LessonSyncPlan {
  const existingBySlug = new Map(existing.map((row) => [row.slug, row]));

  const toCreate: LessonRow[] = [];
  const toUpdate: LessonRow[] = [];
  const unchanged: LessonRow[] = [];

  for (const row of desired) {
    const current = existingBySlug.get(row.slug);
    if (!current) {
      toCreate.push(row);
    } else if (sameLesson(row, current)) {
      unchanged.push(row);
    } else {
      toUpdate.push(row);
    }
  }

  return { toCreate, toUpdate, unchanged };
}
