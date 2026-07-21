import { describe, expect, it } from "vitest";
import { reconcileForensics } from "./reconcile";
import type { ForensicsQuestionRow } from "./parse";

const ROW: ForensicsQuestionRow = {
  id: "forensics.q.base64-harden",
  archetype: "DECODING",
  skillNodeId: "forensics.core.decoding",
  prompt: "Decode the string.",
  given: "aGFyZGVuIGV2ZXJ5dGhpbmc=",
  sortOrder: 0,
};

describe("reconcileForensics", () => {
  it("creates a question with no existing row", () => {
    const plan = reconcileForensics([ROW], []);
    expect(plan.toCreate).toEqual([ROW]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toRemove).toEqual([]);
    expect(plan.unchanged).toEqual([]);
  });

  it("reports unchanged when the row is identical", () => {
    const plan = reconcileForensics([ROW], [ROW]);
    expect(plan.unchanged).toEqual([ROW]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
  });

  it("updates when prompt/given/sortOrder/skillNodeId/archetype changes", () => {
    const changed: ForensicsQuestionRow = { ...ROW, prompt: "Decode the new string." };
    const plan = reconcileForensics([changed], [ROW]);
    expect(plan.toUpdate).toEqual([changed]);
    expect(plan.unchanged).toEqual([]);
  });

  it("hard-removes a question dropped from the YAML", () => {
    const dropped: ForensicsQuestionRow = { ...ROW, id: "forensics.q.gone" };
    const plan = reconcileForensics([], [dropped]);
    expect(plan.toRemove).toEqual([dropped]);
  });

  it("handles a mixed batch: create, update, remove, unchanged together", () => {
    const unchangedRow = ROW;
    const updatedExisting: ForensicsQuestionRow = { ...ROW, id: "forensics.q.updated", given: "old" };
    const updatedDesired: ForensicsQuestionRow = { ...updatedExisting, given: "new" };
    const removedRow: ForensicsQuestionRow = { ...ROW, id: "forensics.q.removed" };
    const createdRow: ForensicsQuestionRow = { ...ROW, id: "forensics.q.created" };

    const plan = reconcileForensics(
      [unchangedRow, updatedDesired, createdRow],
      [unchangedRow, updatedExisting, removedRow],
    );

    expect(plan.toCreate).toEqual([createdRow]);
    expect(plan.toUpdate).toEqual([updatedDesired]);
    expect(plan.toRemove).toEqual([removedRow]);
    expect(plan.unchanged).toEqual([unchangedRow]);
  });
});
