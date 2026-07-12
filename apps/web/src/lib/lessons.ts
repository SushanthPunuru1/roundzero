// Pure lesson-list domain logic — no DB/framework imports, fully unit-testable.
// The index page (apps/app/lessons/page.tsx) queries Prisma and layers this
// grouping/formatting on top.

import type { TrackLevel } from "@roundzero/db";

export interface LessonListItem {
  slug: string;
  title: string;
  domainId: string;
  level: TrackLevel;
  minutes: number;
  sortOrder: number;
}

export interface LessonGroup {
  domainId: string;
  domainTitle: string;
  lessons: LessonListItem[];
}

export function levelLabel(level: TrackLevel): string {
  switch (level) {
    case "FOUNDATIONS":
      return "Foundations";
    case "STANDARD":
      return "Standard";
    case "ADVANCED":
      return "Advanced";
  }
}

export function groupLessonsByDomain(
  lessons: LessonListItem[],
  domainTitles: Map<string, string>,
): LessonGroup[] {
  const groups = new Map<string, LessonListItem[]>();
  for (const lesson of lessons) {
    const existing = groups.get(lesson.domainId);
    if (existing) {
      existing.push(lesson);
    } else {
      groups.set(lesson.domainId, [lesson]);
    }
  }

  return Array.from(groups.entries()).map(([domainId, groupLessons]) => ({
    domainId,
    domainTitle: domainTitles.get(domainId) ?? domainId,
    lessons: [...groupLessons].sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}
