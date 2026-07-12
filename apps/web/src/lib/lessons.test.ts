import { describe, expect, it } from "vitest";

import { groupLessonsByDomain, levelLabel, type LessonListItem } from "./lessons";

describe("levelLabel", () => {
  it("maps every TrackLevel value to a sentence-case label", () => {
    expect(levelLabel("FOUNDATIONS")).toBe("Foundations");
    expect(levelLabel("STANDARD")).toBe("Standard");
    expect(levelLabel("ADVANCED")).toBe("Advanced");
  });
});

describe("groupLessonsByDomain", () => {
  const lesson = (overrides: Partial<LessonListItem>): LessonListItem => ({
    slug: "slug",
    title: "Title",
    domainId: "foundations",
    level: "FOUNDATIONS",
    minutes: 5,
    sortOrder: 0,
    ...overrides,
  });

  it("groups lessons by domainId and sorts within a group by sortOrder", () => {
    const lessons = [
      lesson({ slug: "b", domainId: "foundations", sortOrder: 2 }),
      lesson({ slug: "a", domainId: "foundations", sortOrder: 1 }),
      lesson({ slug: "c", domainId: "linux", sortOrder: 1 }),
    ];

    const groups = groupLessonsByDomain(
      lessons,
      new Map([
        ["foundations", "Foundations"],
        ["linux", "Linux"],
      ]),
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({
      domainId: "foundations",
      domainTitle: "Foundations",
      lessons: [lesson({ slug: "a", domainId: "foundations", sortOrder: 1 }), lesson({ slug: "b", domainId: "foundations", sortOrder: 2 })],
    });
    expect(groups[1]?.domainTitle).toBe("Linux");
  });

  it("falls back to the raw domainId when no title is known", () => {
    const groups = groupLessonsByDomain([lesson({ domainId: "mystery" })], new Map());
    expect(groups[0]?.domainTitle).toBe("mystery");
  });

  it("returns an empty array for no lessons", () => {
    expect(groupLessonsByDomain([], new Map())).toEqual([]);
  });
});
