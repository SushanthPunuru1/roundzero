import { describe, expect, it } from "vitest";

import {
  diffFork,
  initialForkItems,
  isCleanFork,
  reorder,
  resolveFork,
  type ForkItemRow,
  type UpstreamItem,
} from "./fork";

function U(id: string, sortOrder: number, over: Partial<UpstreamItem> = {}): UpstreamItem {
  return {
    id,
    skillNodeId: `linux.core.${id}`,
    sortOrder,
    action: `Do ${id}`,
    why: `Because ${id}`,
    commands: { ubuntu22: `run ${id}` },
    lessonSlug: null,
    caution: null,
    ...over,
  };
}

const UPSTREAM = [U("a", 0), U("b", 1), U("c", 2)];

function row(over: Partial<ForkItemRow> & { id: string }): ForkItemRow {
  return {
    upstreamItemId: over.id,
    sortOrder: 0,
    action: null,
    why: null,
    commands: null,
    removed: false,
    ...over,
  };
}

/** A fresh fork, with row ids matching upstream ids for readability. */
function freshFork(upstream = UPSTREAM): ForkItemRow[] {
  return initialForkItems(upstream).map((r, i) => ({ ...r, id: `row-${i}` }));
}

describe("initialForkItems", () => {
  it("creates one override-free row per upstream item, densely ordered", () => {
    const items = initialForkItems([U("c", 7), U("a", 2), U("b", 5)]);
    expect(items.map((i) => i.upstreamItemId)).toEqual(["a", "b", "c"]);
    expect(items.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
    expect(items.every((i) => i.action === null && i.why === null && i.commands === null)).toBe(true);
  });
});

describe("resolveFork", () => {
  it("a fresh fork resolves byte-identically to upstream", () => {
    const resolved = resolveFork(freshFork(), UPSTREAM);
    expect(resolved.map((r) => r.action)).toEqual(["Do a", "Do b", "Do c"]);
    expect(resolved.every((r) => r.origin === "upstream")).toBe(true);
    expect(resolved.every((r) => r.editedFields.length === 0)).toBe(true);
  });

  // The reason a fork stores overrides instead of copies: a team that never
  // touched an item keeps getting upstream's corrections.
  it("keeps inheriting upstream edits on fields the team never overrode", () => {
    const fork = freshFork();
    const upstreamFixed = [U("a", 0, { action: "Do a (corrected)" }), U("b", 1), U("c", 2)];
    const resolved = resolveFork(fork, upstreamFixed);
    expect(resolved[0]!.action).toBe("Do a (corrected)");
    expect(resolved[0]!.origin).toBe("upstream");
  });

  it("pins only the overridden field, still inheriting the rest of that item", () => {
    const fork = freshFork();
    fork[0]!.action = "Our own wording";
    const upstreamFixed = [U("a", 0, { action: "Upstream reworded", why: "Upstream new why" })];
    const resolved = resolveFork(fork, [...upstreamFixed, U("b", 1), U("c", 2)]);
    expect(resolved[0]!.action).toBe("Our own wording");
    expect(resolved[0]!.why).toBe("Upstream new why");
    expect(resolved[0]!.origin).toBe("edited");
    expect(resolved[0]!.editedFields).toEqual(["action"]);
  });

  it("does not call an override an edit when it matches upstream exactly", () => {
    const fork = freshFork();
    fork[0]!.action = "Do a"; // same text upstream already has
    const resolved = resolveFork(fork, UPSTREAM);
    expect(resolved[0]!.origin).toBe("upstream");
    expect(resolved[0]!.editedFields).toEqual([]);
  });

  it("carries team-added items with their own text and no upstream link", () => {
    const fork = [
      ...freshFork(),
      row({ id: "own", upstreamItemId: null, sortOrder: 3, action: "Our step", why: "Ours" }),
    ];
    const resolved = resolveFork(fork, UPSTREAM);
    expect(resolved[3]).toMatchObject({ origin: "team-added", action: "Our step", upstreamItemId: null });
  });

  it("respects team ordering over upstream ordering", () => {
    const fork = freshFork();
    fork[0]!.sortOrder = 2;
    fork[2]!.sortOrder = 0;
    expect(resolveFork(fork, UPSTREAM).map((r) => r.upstreamItemId)).toEqual(["c", "b", "a"]);
  });

  it("drops a row whose upstream item was retired rather than rendering it blank", () => {
    const fork = freshFork();
    const resolved = resolveFork(fork, [U("a", 0), U("c", 2)]);
    expect(resolved.map((r) => r.upstreamItemId)).toEqual(["a", "c"]);
  });
});

describe("diffFork", () => {
  it("reports nothing for a fresh fork against unchanged upstream", () => {
    const diff = diffFork(freshFork(), UPSTREAM);
    expect(isCleanFork(diff)).toBe(true);
  });

  it("reports upstream items the fork has never seen", () => {
    const diff = diffFork(freshFork(), [...UPSTREAM, U("d", 3)]);
    expect(diff.added.map((i) => i.id)).toEqual(["d"]);
    expect(isCleanFork(diff)).toBe(false);
  });

  // The category that actually matters: the team is pinned to older wording
  // and will never see the correction unless told.
  it("reports an upstream change hidden underneath a team override", () => {
    const fork = freshFork();
    fork[1]!.action = "Our wording";
    const diff = diffFork(fork, [U("a", 0), U("b", 1, { action: "Upstream corrected" }), U("c", 2)]);
    expect(diff.updatedConflicting).toHaveLength(1);
    expect(diff.updatedConflicting[0]!.item.id).toBe("b");
    expect(diff.updatedConflicting[0]!.fields).toEqual(["action"]);
    expect(diff.updatedConflicting[0]!.teamValues.action).toBe("Our wording");
  });

  it("does NOT report a conflict when the team override happens to match upstream", () => {
    const fork = freshFork();
    fork[1]!.action = "Do b";
    expect(diffFork(fork, UPSTREAM).updatedConflicting).toEqual([]);
  });

  it("does NOT report a conflict on a field the team never overrode", () => {
    // The team already sees the new text — nothing to act on.
    const fork = freshFork();
    const diff = diffFork(fork, [U("a", 0, { action: "Reworded upstream" }), U("b", 1), U("c", 2)]);
    expect(diff.updatedConflicting).toEqual([]);
    expect(isCleanFork(diff)).toBe(true);
  });

  it("distinguishes a team-removed item from one upstream never had", () => {
    const fork = freshFork();
    fork[2]!.removed = true;
    const diff = diffFork(fork, UPSTREAM);
    expect(diff.removedByTeam.map((i) => i.id)).toEqual(["c"]);
    expect(diff.added).toEqual([]);
  });

  it("reports rows whose upstream item was retired", () => {
    const diff = diffFork(freshFork(), [U("a", 0), U("b", 1)]);
    expect(diff.retiredUpstream).toEqual(["c"]);
  });

  it("counts team-added items and ignores removed ones", () => {
    const fork = [
      ...freshFork(),
      row({ id: "own1", upstreamItemId: null, sortOrder: 3, action: "x" }),
      row({ id: "own2", upstreamItemId: null, sortOrder: 4, action: "y", removed: true }),
    ];
    expect(diffFork(fork, UPSTREAM).teamAdded).toBe(1);
  });

  it("detects a commands override regardless of key order", () => {
    const fork = freshFork();
    fork[0]!.commands = { ubuntu24: "b", ubuntu22: "a" };
    const upstream = [U("a", 0, { commands: { ubuntu22: "a", ubuntu24: "b" } }), U("b", 1), U("c", 2)];
    expect(diffFork(fork, upstream).updatedConflicting).toEqual([]);

    fork[0]!.commands = { ubuntu22: "different" };
    expect(diffFork(fork, upstream).updatedConflicting).toHaveLength(1);
  });
});

describe("reorder", () => {
  const items = [
    { id: "a", sortOrder: 0 },
    { id: "b", sortOrder: 1 },
    { id: "c", sortOrder: 2 },
  ];

  it("returns only the rows whose position actually changed", () => {
    expect(reorder(items, "c", 0)).toEqual([
      { id: "c", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
    ]);
  });

  it("writes nothing when the item is already at that index", () => {
    expect(reorder(items, "b", 1)).toEqual([]);
  });

  it("clamps an out-of-range target instead of corrupting the order", () => {
    expect(reorder(items, "a", 99).map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(reorder(items, "c", -5).map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("ignores an unknown id", () => {
    expect(reorder(items, "nope", 0)).toEqual([]);
  });

  it("always produces a dense 0..n-1 sequence so printed numbering means something", () => {
    const sparse = [
      { id: "a", sortOrder: 5 },
      { id: "b", sortOrder: 40 },
      { id: "c", sortOrder: 900 },
    ];
    const changed = reorder(sparse, "c", 0);
    const final = new Map(changed.map((c) => [c.id, c.sortOrder]));
    expect([...final.values()].sort((x, y) => x - y)).toEqual([0, 1, 2]);
  });
});
