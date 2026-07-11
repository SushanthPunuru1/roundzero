import { describe, expect, it } from "vitest";
import type { DesiredNode } from "./parse";
import { reconcile, type ExistingNode } from "./reconcile";

const domain: DesiredNode = {
  id: "foundations",
  parentId: null,
  title: "Foundations",
  kind: "DOMAIN",
  level: null,
  sortOrder: 0,
};

function asExisting(node: DesiredNode, deprecated = false): ExistingNode {
  return { ...node, deprecated };
}

describe("reconcile", () => {
  it("puts a node with no existing row into toCreate", () => {
    const plan = reconcile([domain], []);
    expect(plan.toCreate).toEqual([domain]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toDeprecate).toEqual([]);
    expect(plan.unchanged).toEqual([]);
  });

  it("puts a node with a changed field into toUpdate", () => {
    const existing = asExisting({ ...domain, title: "Old title" });
    const plan = reconcile([domain], [existing]);
    expect(plan.toUpdate).toEqual([{ ...domain, deprecated: false }]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.unchanged).toEqual([]);
  });

  it("puts an identical node into unchanged", () => {
    const existing = asExisting(domain);
    const plan = reconcile([domain], [existing]);
    expect(plan.unchanged).toEqual([existing]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toDeprecate).toEqual([]);
  });

  it("deprecates an existing row absent from desired, then leaves it unchanged next run", () => {
    const existing = asExisting(domain);
    const firstRun = reconcile([], [existing]);
    expect(firstRun.toDeprecate).toEqual([existing]);
    expect(firstRun.unchanged).toEqual([]);

    const nowDeprecated = asExisting(domain, true);
    const secondRun = reconcile([], [nowDeprecated]);
    expect(secondRun.toDeprecate).toEqual([]);
    expect(secondRun.unchanged).toEqual([nowDeprecated]);
  });

  it("un-deprecates a previously deprecated node that reappears in the YAML", () => {
    const existing = asExisting(domain, true);
    const plan = reconcile([domain], [existing]);
    expect(plan.toUpdate).toEqual([{ ...domain, deprecated: false }]);
    expect(plan.toDeprecate).toEqual([]);
    expect(plan.unchanged).toEqual([]);
  });
});
