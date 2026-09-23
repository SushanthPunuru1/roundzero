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

/** A domain as the taxonomy defines it. `sortOrder` is the domain's index in
 * `taxonomy.yaml`, written by the seed — so it is the taxonomy's deliberate
 * teaching order, not an alphabetical accident. */
export interface DomainMeta {
  id: string;
  title: string;
  sortOrder: number;
}

/**
 * The difficulty of a lesson, NOT the domain it belongs to.
 *
 * "Foundations" was the old label for the easiest tier, and on the index it
 * rendered as a chip directly beneath a section heading that also said
 * FOUNDATIONS — one word meaning two different things, a few pixels apart.
 * "Intro" and "Core" carry the same meaning with no collision.
 *
 * The DB enum is untouched: this is a display function, so renaming here
 * costs no migration and no content edit.
 */
export function levelLabel(level: TrackLevel): string {
  switch (level) {
    case "FOUNDATIONS":
      return "Intro";
    case "STANDARD":
      return "Core";
    case "ADVANCED":
      return "Advanced";
  }
}

/**
 * Groups in the taxonomy's order — the spine, per CLAUDE.md golden rule 2.
 *
 * The index previously relied on the query's `domainId asc`, which is
 * ALPHABETICAL: a beginner opening Lessons for the first time was shown
 * Forensics at the top and Foundations below it. That is not a styling
 * problem, it is the wrong teaching order hiding in a sort clause.
 *
 * A domain the taxonomy does not know about sorts last rather than being
 * dropped — content can legitimately run ahead of the taxonomy (see
 * `findCoverageGaps`, which reports rather than throws), and silently hiding
 * a published lesson would be far worse than listing it at the bottom.
 */
export function groupLessonsByDomain(
  lessons: LessonListItem[],
  domains: DomainMeta[],
): LessonGroup[] {
  const meta = new Map(domains.map((domain) => [domain.id, domain]));

  const groups = new Map<string, LessonListItem[]>();
  for (const lesson of lessons) {
    const existing = groups.get(lesson.domainId);
    if (existing) {
      existing.push(lesson);
    } else {
      groups.set(lesson.domainId, [lesson]);
    }
  }

  return Array.from(groups.entries())
    .map(([domainId, groupLessons]) => ({
      domainId,
      domainTitle: meta.get(domainId)?.title ?? domainId,
      lessons: [...groupLessons].sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .sort((a, b) => {
      const orderA = meta.get(a.domainId)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = meta.get(b.domainId)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      // Tie-break by id so two unknown domains have a stable order rather
      // than depending on which lesson happened to be read first.
      return orderA - orderB || a.domainId.localeCompare(b.domainId);
    });
}
