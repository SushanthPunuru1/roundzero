import { describe, expect, it } from "vitest";
import { bestScore, gradeCheck } from "./grade";
import type { CheckQuestion } from "./parse";

const CHECK: CheckQuestion[] = [
  { q: "Q1", options: ["A", "B"], answer: 1, why: "why1" },
  { q: "Q2", options: ["A", "B"], answer: 0, why: "why2" },
  { q: "Q3", options: ["A", "B", "C"], answer: 2, why: "why3" },
];

describe("gradeCheck", () => {
  it("scores 100 when every answer is correct", () => {
    const result = gradeCheck(CHECK, [1, 0, 2]);
    expect(result).toEqual({ correct: 3, total: 3, score: 100, results: [true, true, true] });
  });

  it("scores 0 when every answer is wrong", () => {
    const result = gradeCheck(CHECK, [0, 1, 0]);
    expect(result).toEqual({ correct: 0, total: 3, score: 0, results: [false, false, false] });
  });

  it("rounds a partial score (1/3 correct -> 33)", () => {
    const result = gradeCheck(CHECK, [1, 1, 0]);
    expect(result.correct).toBe(1);
    expect(result.score).toBe(33);
    expect(result.results).toEqual([true, false, false]);
  });

  it("rounds a partial score (2/3 correct -> 67)", () => {
    const result = gradeCheck(CHECK, [1, 0, 0]);
    expect(result.correct).toBe(2);
    expect(result.score).toBe(67);
  });

  it("throws when the answer count doesn't match the question count", () => {
    expect(() => gradeCheck(CHECK, [1, 0])).toThrow(RangeError);
  });
});

describe("bestScore", () => {
  it("returns the new score when there is no previous attempt", () => {
    expect(bestScore(null, 40)).toBe(40);
    expect(bestScore(undefined, 40)).toBe(40);
  });

  it("keeps the higher of the two scores", () => {
    expect(bestScore(80, 40)).toBe(80);
    expect(bestScore(40, 80)).toBe(80);
  });

  it("retakes never lower a persisted best score", () => {
    expect(bestScore(100, 0)).toBe(100);
  });
});
