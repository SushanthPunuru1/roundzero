import { describe, expect, it } from "vitest";
import { gradeAnswer, normalizeAnswer } from "./grade";
import type { QuizAnswerSpec } from "./grade";

describe("normalizeAnswer", () => {
  it("always trims", () => {
    expect(normalizeAnswer("  hi  ", { caseSensitive: true, stripTrailingSlash: false, collapseWhitespace: false })).toBe("hi");
  });

  it("lowercases unless caseSensitive", () => {
    expect(normalizeAnswer("HI", { caseSensitive: false, stripTrailingSlash: false, collapseWhitespace: false })).toBe("hi");
    expect(normalizeAnswer("HI", { caseSensitive: true, stripTrailingSlash: false, collapseWhitespace: false })).toBe("HI");
  });

  it("strips exactly one trailing slash run when enabled", () => {
    expect(normalizeAnswer("/a/b/", { caseSensitive: true, stripTrailingSlash: true, collapseWhitespace: false })).toBe("/a/b");
    expect(normalizeAnswer("/a/b///", { caseSensitive: true, stripTrailingSlash: true, collapseWhitespace: false })).toBe("/a/b");
    expect(normalizeAnswer("/a/b", { caseSensitive: true, stripTrailingSlash: false, collapseWhitespace: false })).toBe("/a/b");
  });

  it("collapses internal whitespace runs when enabled", () => {
    expect(normalizeAnswer("a  b   c", { caseSensitive: true, stripTrailingSlash: false, collapseWhitespace: true })).toBe("a b c");
  });
});

describe("gradeAnswer", () => {
  const base: QuizAnswerSpec = {
    answer: "harden everything",
    accepts: [],
    caseSensitive: false,
    stripTrailingSlash: false,
  };

  it("marks an exact match correct", () => {
    expect(gradeAnswer(base, "harden everything")).toEqual({ status: "correct" });
  });

  it("is forgiving of surrounding whitespace and case when not case-sensitive", () => {
    expect(gradeAnswer(base, "  Harden Everything  ")).toEqual({ status: "correct" });
  });

  it("accepts any entry in accepts[]", () => {
    const spec: QuizAnswerSpec = { ...base, answer: "nc", accepts: ["nc", "netcat"] };
    expect(gradeAnswer(spec, "netcat")).toEqual({ status: "correct" });
  });

  it("marks a wholly wrong answer incorrect with no diff", () => {
    expect(gradeAnswer(base, "not even close")).toEqual({ status: "incorrect" });
  });

  it("flags a case mismatch as close when the question is case-sensitive", () => {
    const spec: QuizAnswerSpec = { ...base, answer: "telnetd", caseSensitive: true };
    const result = gradeAnswer(spec, "TELNETD");
    expect(result.status).toBe("close");
    expect(result.diff).toEqual({
      caseMismatch: true,
      trailingSlashMismatch: false,
      whitespaceMismatch: false,
    });
  });

  it("does not flag case when the question is not case-sensitive (it's just correct)", () => {
    const spec: QuizAnswerSpec = { ...base, answer: "telnetd", caseSensitive: false };
    expect(gradeAnswer(spec, "TELNETD")).toEqual({ status: "correct" });
  });

  it("flags a trailing-slash mismatch as close when the question doesn't strip it", () => {
    const spec: QuizAnswerSpec = {
      ...base,
      answer: "/home/priya/Downloads/leaked",
      stripTrailingSlash: false,
    };
    const result = gradeAnswer(spec, "/home/priya/Downloads/leaked/");
    expect(result.status).toBe("close");
    expect(result.diff).toEqual({
      caseMismatch: false,
      trailingSlashMismatch: true,
      whitespaceMismatch: false,
    });
  });

  it("does not flag a trailing slash when the question strips it (it's just correct)", () => {
    const spec: QuizAnswerSpec = {
      ...base,
      answer: "/home/priya/Downloads/leaked",
      stripTrailingSlash: true,
    };
    expect(gradeAnswer(spec, "/home/priya/Downloads/leaked/")).toEqual({ status: "correct" });
  });

  it("flags a doubled-internal-space mismatch as close", () => {
    const spec: QuizAnswerSpec = {
      ...base,
      answer: "/home/agent47/Desktop/Prohibited Media",
    };
    const result = gradeAnswer(spec, "/home/agent47/Desktop/Prohibited  Media");
    expect(result.status).toBe("close");
    expect(result.diff).toEqual({
      caseMismatch: false,
      trailingSlashMismatch: false,
      whitespaceMismatch: true,
    });
  });

  it("can flag multiple diff axes at once", () => {
    const spec: QuizAnswerSpec = {
      answer: "/Home/Agent47/Prohibited  Media/",
      accepts: [],
      caseSensitive: true,
      stripTrailingSlash: false,
    };
    const result = gradeAnswer(spec, "/home/agent47/prohibited media");
    expect(result.status).toBe("close");
    expect(result.diff).toEqual({
      caseMismatch: true,
      trailingSlashMismatch: true,
      whitespaceMismatch: true,
    });
  });

  it("grades a question with no evidence block or technique the same way (networking-style question)", () => {
    const spec: QuizAnswerSpec = {
      answer: "copy running-config startup-config",
      accepts: ["copy run start"],
      caseSensitive: false,
      stripTrailingSlash: false,
    };
    expect(gradeAnswer(spec, "copy run start")).toEqual({ status: "correct" });
  });
});
