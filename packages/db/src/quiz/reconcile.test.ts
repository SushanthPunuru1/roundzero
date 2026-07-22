import { describe, expect, it } from "vitest";
import { reconcileQuiz } from "./reconcile";
import type { QuizQuestionRow } from "./parse";

const ROW: QuizQuestionRow = {
  id: "networking-quiz.q.port-rdp",
  quizId: "networking",
  category: "ports",
  skillNodeId: "networking.fundamentals.ports",
  prompt: "What port does RDP use?",
  given: null,
  sortOrder: 0,
};

describe("reconcileQuiz", () => {
  it("creates a question with no existing row", () => {
    const plan = reconcileQuiz([ROW], []);
    expect(plan.toCreate).toEqual([ROW]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toRemove).toEqual([]);
    expect(plan.unchanged).toEqual([]);
  });

  it("reports unchanged when the row is identical", () => {
    const plan = reconcileQuiz([ROW], [ROW]);
    expect(plan.unchanged).toEqual([ROW]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
  });

  it("updates when prompt/given/sortOrder/skillNodeId/category/quizId changes", () => {
    const changed: QuizQuestionRow = { ...ROW, prompt: "What port does RDP use, exactly?" };
    const plan = reconcileQuiz([changed], [ROW]);
    expect(plan.toUpdate).toEqual([changed]);
    expect(plan.unchanged).toEqual([]);
  });

  it("hard-removes a question dropped from the YAML", () => {
    const dropped: QuizQuestionRow = { ...ROW, id: "networking-quiz.q.gone" };
    const plan = reconcileQuiz([], [dropped]);
    expect(plan.toRemove).toEqual([dropped]);
  });

  it("handles a mixed batch: create, update, remove, unchanged together", () => {
    const unchangedRow = ROW;
    const updatedExisting: QuizQuestionRow = { ...ROW, id: "networking-quiz.q.updated", given: "old" };
    const updatedDesired: QuizQuestionRow = { ...updatedExisting, given: "new" };
    const removedRow: QuizQuestionRow = { ...ROW, id: "networking-quiz.q.removed" };
    const createdRow: QuizQuestionRow = { ...ROW, id: "networking-quiz.q.created" };

    const plan = reconcileQuiz(
      [unchangedRow, updatedDesired, createdRow],
      [unchangedRow, updatedExisting, removedRow],
    );

    expect(plan.toCreate).toEqual([createdRow]);
    expect(plan.toUpdate).toEqual([updatedDesired]);
    expect(plan.toRemove).toEqual([removedRow]);
    expect(plan.unchanged).toEqual([unchangedRow]);
  });
});
