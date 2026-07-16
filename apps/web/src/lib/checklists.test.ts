import { describe, expect, it } from "vitest";

import {
  commandEntries,
  commandLabel,
  groupItemsIntoSections,
  osLabel,
  type ChecklistItemView,
} from "./checklists";

describe("osLabel", () => {
  it("maps OS enum values to sentence-case labels", () => {
    expect(osLabel("LINUX")).toBe("Linux");
    expect(osLabel("WINDOWS")).toBe("Windows");
  });
});

describe("commandLabel", () => {
  it("maps known keys to friendly labels", () => {
    expect(commandLabel("all")).toBe("All versions");
    expect(commandLabel("ubuntu22")).toBe("Ubuntu 22.04");
    expect(commandLabel("ubuntu24")).toBe("Ubuntu 24.04");
  });

  it("falls back to the raw key for an unknown label", () => {
    expect(commandLabel("windows11")).toBe("windows11");
  });
});

describe("commandEntries", () => {
  it("puts 'all' first, then the rest alphabetically", () => {
    expect(commandEntries({ ubuntu24: "b", all: "a", ubuntu22: "c" })).toEqual([
      ["all", "a"],
      ["ubuntu22", "c"],
      ["ubuntu24", "b"],
    ]);
  });

  it("is stable regardless of source object key order (jsonb doesn't preserve it)", () => {
    const orderA = commandEntries({ ubuntu22: "x", ubuntu24: "y" });
    const orderB = commandEntries({ ubuntu24: "y", ubuntu22: "x" });
    expect(orderA).toEqual(orderB);
  });

  it("sorts alphabetically with no 'all' key present", () => {
    expect(commandEntries({ b: "2", a: "1" })).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
  });
});

describe("groupItemsIntoSections", () => {
  const item = (overrides: Partial<ChecklistItemView>): ChecklistItemView => ({
    id: "item",
    skillNodeId: "skill",
    sortOrder: 0,
    action: "Do it",
    why: "Because",
    commands: { all: "cmd" },
    lessonSlug: null,
    caution: null,
    categoryId: "linux.accounts",
    categoryTitle: "Accounts and authentication",
    ...overrides,
  });

  it("gives a plain header to a multi-item first occurrence", () => {
    const items = [
      item({ id: "a", categoryId: "cat.a", categoryTitle: "Cat A", sortOrder: 10 }),
      item({ id: "b", categoryId: "cat.a", categoryTitle: "Cat A", sortOrder: 20 }),
    ];
    const sections = groupItemsIntoSections(items);

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      categoryId: "cat.a",
      headerTitle: "Cat A",
      anchor: "cat-a",
    });
    expect(sections[0]!.items).toEqual(items);
  });

  it("renders a single-item first occurrence without a header or anchor", () => {
    const items = [item({ id: "a", categoryId: "cat.a", categoryTitle: "Cat A" })];
    const sections = groupItemsIntoSections(items);

    expect(sections).toHaveLength(1);
    expect(sections[0]!.headerTitle).toBeNull();
    expect(sections[0]!.anchor).toBeNull();
  });

  it("preserves authored order and marks a recurring category '— continued'", () => {
    const items = [
      item({ id: "a1", categoryId: "cat.a", categoryTitle: "Cat A", sortOrder: 10 }),
      item({ id: "a2", categoryId: "cat.a", categoryTitle: "Cat A", sortOrder: 20 }),
      item({ id: "b1", categoryId: "cat.b", categoryTitle: "Cat B", sortOrder: 30 }),
      item({ id: "b2", categoryId: "cat.b", categoryTitle: "Cat B", sortOrder: 35 }),
      item({ id: "a3", categoryId: "cat.a", categoryTitle: "Cat A", sortOrder: 40 }),
    ];
    const sections = groupItemsIntoSections(items);

    expect(sections.map((s) => s.categoryId)).toEqual(["cat.a", "cat.b", "cat.a"]);
    expect(sections[0]!.headerTitle).toBe("Cat A");
    expect(sections[0]!.anchor).toBe("cat-a");
    expect(sections[1]!.headerTitle).toBe("Cat B");
    expect(sections[2]!.headerTitle).toBe("Cat A — continued");
    expect(sections[2]!.anchor).toBe("cat-a-2");
    expect(sections.map((s) => s.items.map((i) => i.id))).toEqual([
      ["a1", "a2"],
      ["b1", "b2"],
      ["a3"],
    ]);
  });

  it("still headers a single-item run that is a recurrence", () => {
    const items = [
      item({ id: "a1", categoryId: "cat.a", categoryTitle: "Cat A", sortOrder: 10 }),
      item({ id: "a2", categoryId: "cat.a", categoryTitle: "Cat A", sortOrder: 20 }),
      item({ id: "b1", categoryId: "cat.b", categoryTitle: "Cat B", sortOrder: 30 }),
      item({ id: "a3", categoryId: "cat.a", categoryTitle: "Cat A", sortOrder: 40 }), // single-item recurrence run
    ];
    const sections = groupItemsIntoSections(items);
    const recurrence = sections[2]!;

    expect(recurrence.items).toHaveLength(1);
    expect(recurrence.headerTitle).toBe("Cat A — continued");
    expect(recurrence.anchor).not.toBeNull();
  });

  it("TOC-relevant sections are exactly those with a non-null headerTitle", () => {
    const items = [
      item({ id: "solo", categoryId: "cat.solo", categoryTitle: "Solo", sortOrder: 10 }),
      item({ id: "a1", categoryId: "cat.a", categoryTitle: "Cat A", sortOrder: 20 }),
      item({ id: "a2", categoryId: "cat.a", categoryTitle: "Cat A", sortOrder: 30 }),
    ];
    const sections = groupItemsIntoSections(items);
    const toc = sections.filter((s) => s.headerTitle !== null);

    expect(sections).toHaveLength(2);
    expect(toc).toHaveLength(1);
    expect(toc[0]!.categoryId).toBe("cat.a");
  });

  it("returns an empty array for no items", () => {
    expect(groupItemsIntoSections([])).toEqual([]);
  });
});
