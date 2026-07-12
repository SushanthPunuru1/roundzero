import { describe, expect, it } from "vitest";
import { reconcileLessons, type ExistingLessonRow, type LessonRow } from "./reconcile";

const row: LessonRow = {
  slug: "scoring-engine",
  title: "How the scoring engine behaves",
  domainId: "foundations",
  level: "FOUNDATIONS",
  minutes: 7,
  sortOrder: 1,
  published: true,
  skills: ["foundations.competition.scoring-engine"],
};

function asExisting(desired: LessonRow): ExistingLessonRow {
  return { ...desired };
}

describe("reconcileLessons", () => {
  it("puts a lesson with no existing row into toCreate", () => {
    const plan = reconcileLessons([row], []);
    expect(plan.toCreate).toEqual([row]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.unchanged).toEqual([]);
  });

  it("puts an identical lesson into unchanged", () => {
    const existing = asExisting(row);
    const plan = reconcileLessons([row], [existing]);
    expect(plan.unchanged).toEqual([row]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
  });

  it("treats a different skill-set order as unchanged", () => {
    const multiSkill: LessonRow = { ...row, skills: ["a.b.c", "a.b.d"] };
    const existing = asExisting({ ...multiSkill, skills: ["a.b.d", "a.b.c"] });
    const plan = reconcileLessons([multiSkill], [existing]);
    expect(plan.unchanged).toEqual([multiSkill]);
  });

  it("puts a lesson with a changed field into toUpdate", () => {
    const existing = asExisting({ ...row, minutes: 5 });
    const plan = reconcileLessons([row], [existing]);
    expect(plan.toUpdate).toEqual([row]);
    expect(plan.unchanged).toEqual([]);
  });

  it("puts a lesson with a changed skill set into toUpdate", () => {
    const existing = asExisting({ ...row, skills: ["a.different.skill"] });
    const plan = reconcileLessons([row], [existing]);
    expect(plan.toUpdate).toEqual([row]);
  });

  it("leaves a lesson absent from desired alone (no deprecate concept)", () => {
    const existing = asExisting(row);
    const plan = reconcileLessons([], [existing]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.unchanged).toEqual([]);
  });
});
