import { describe, expect, it } from "vitest";

import {
  groupLessonsByDomain,
  levelLabel,
  type DomainMeta,
  type LessonListItem,
} from "./lessons";

describe("levelLabel", () => {
  it("maps every TrackLevel to a label that isn't also a domain name", () => {
    // "Foundations" was the old label for the easiest tier, and it rendered
    // as a chip directly under a section heading that also said FOUNDATIONS.
    expect(levelLabel("FOUNDATIONS")).toBe("Intro");
    expect(levelLabel("STANDARD")).toBe("Core");
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

  const domain = (
    id: string,
    title: string,
    sortOrder: number,
  ): DomainMeta => ({ id, title, sortOrder });

  it("groups lessons by domainId and sorts within a group by sortOrder", () => {
    const lessons = [
      lesson({ slug: "b", domainId: "foundations", sortOrder: 2 }),
      lesson({ slug: "a", domainId: "foundations", sortOrder: 1 }),
      lesson({ slug: "c", domainId: "linux", sortOrder: 1 }),
    ];

    const groups = groupLessonsByDomain(lessons, [
      domain("foundations", "Foundations", 0),
      domain("linux", "Linux", 1),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({
      domainId: "foundations",
      domainTitle: "Foundations",
      lessons: [
        lesson({ slug: "a", domainId: "foundations", sortOrder: 1 }),
        lesson({ slug: "b", domainId: "foundations", sortOrder: 2 }),
      ],
    });
    expect(groups[1]?.domainTitle).toBe("Linux");
  });

  it("orders groups by the taxonomy, not alphabetically", () => {
    // The regression this exists for: the index relied on the query's
    // `domainId asc`, so a beginner's first view of Lessons led with
    // Forensics and buried Foundations below it.
    const lessons = [
      lesson({ slug: "f", domainId: "forensics" }),
      lesson({ slug: "n", domainId: "networking" }),
      lesson({ slug: "b", domainId: "foundations" }),
    ];

    const groups = groupLessonsByDomain(lessons, [
      domain("foundations", "Foundations", 0),
      domain("forensics", "Forensics", 3),
      domain("networking", "Networking / Cisco", 4),
    ]);

    expect(groups.map((g) => g.domainId)).toEqual([
      "foundations",
      "forensics",
      "networking",
    ]);
  });

  it("puts a domain the taxonomy doesn't know about last, never hides it", () => {
    // Content may legitimately run ahead of the taxonomy — findCoverageGaps
    // reports that rather than throwing. Dropping a published lesson from
    // the index would be a far worse failure than listing it at the bottom.
    const groups = groupLessonsByDomain(
      [
        lesson({ slug: "x", domainId: "mystery" }),
        lesson({ slug: "b", domainId: "foundations" }),
      ],
      [domain("foundations", "Foundations", 0)],
    );

    expect(groups.map((g) => g.domainId)).toEqual(["foundations", "mystery"]);
    expect(groups[1]?.domainTitle).toBe("mystery");
  });

  it("orders two unknown domains stably, by id", () => {
    const groups = groupLessonsByDomain(
      [lesson({ slug: "z", domainId: "zeta" }), lesson({ slug: "a", domainId: "alpha" })],
      [],
    );
    expect(groups.map((g) => g.domainId)).toEqual(["alpha", "zeta"]);
  });

  it("falls back to the raw domainId when no title is known", () => {
    const groups = groupLessonsByDomain([lesson({ domainId: "mystery" })], []);
    expect(groups[0]?.domainTitle).toBe("mystery");
  });

  it("returns an empty array for no lessons", () => {
    expect(groupLessonsByDomain([], [])).toEqual([]);
  });
});
