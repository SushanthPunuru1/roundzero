import { describe, expect, it } from "vitest";
import {
  LessonError,
  parseLesson,
  parseLessons,
  toLessonRow,
  validateSkillRefs,
  type KnownNode,
} from "./parse";

const VALID_TEXT = `---
slug: scoring-engine
title: How the scoring engine behaves
domainId: foundations
level: foundations
minutes: 7
sortOrder: 1
published: false
skills:
  - foundations.competition.scoring-engine
check:
  - q: "Question one?"
    options: ["A", "B"]
    answer: 1
    why: "Because B."
  - q: "Question two?"
    options: ["A", "B", "C"]
    answer: 0
    why: "Because A."
---

## A heading

Some body text with a \`command\`.
`;

const KNOWN_NODES: KnownNode[] = [
  { id: "foundations", kind: "DOMAIN" },
  { id: "foundations.competition", kind: "CATEGORY" },
  { id: "foundations.competition.scoring-engine", kind: "SKILL" },
];

describe("parseLesson", () => {
  it("parses valid frontmatter and trims the body", () => {
    const { meta, body } = parseLesson(VALID_TEXT, "test.mdx");
    expect(meta).toEqual({
      slug: "scoring-engine",
      title: "How the scoring engine behaves",
      domainId: "foundations",
      level: "FOUNDATIONS",
      minutes: 7,
      sortOrder: 1,
      published: false,
      skills: ["foundations.competition.scoring-engine"],
      check: [
        { q: "Question one?", options: ["A", "B"], answer: 1, why: "Because B." },
        { q: "Question two?", options: ["A", "B", "C"], answer: 0, why: "Because A." },
      ],
    });
    expect(body).toBe("## A heading\n\nSome body text with a `command`.");
  });

  it("rejects text with no frontmatter fence", () => {
    expect(() => parseLesson("just a body", "test.mdx")).toThrow(
      /missing YAML frontmatter/,
    );
  });

  it("rejects an invalid level", () => {
    const text = VALID_TEXT.replace("level: foundations", "level: expert");
    expect(() => parseLesson(text, "test.mdx")).toThrow(
      /"level" must be one of foundations, standard, advanced/,
    );
  });

  it("rejects a non-positive minutes value", () => {
    const text = VALID_TEXT.replace("minutes: 7", "minutes: 0");
    expect(() => parseLesson(text, "test.mdx")).toThrow(/"minutes" must be a positive integer/);
  });

  it("rejects an empty skills array", () => {
    const text = VALID_TEXT.replace(
      "skills:\n  - foundations.competition.scoring-engine",
      "skills: []",
    );
    expect(() => parseLesson(text, "test.mdx")).toThrow(/"skills" must be a non-empty array/);
  });

  it("rejects a malformed skill id", () => {
    const text = VALID_TEXT.replace(
      "foundations.competition.scoring-engine",
      "Not An Id!",
    );
    expect(() => parseLesson(text, "test.mdx")).toThrow(/not a well-formed dotted lowercase id/);
  });

  it("rejects a check question with fewer than 2 options", () => {
    const text = VALID_TEXT.replace('options: ["A", "B"]', 'options: ["A"]');
    expect(() => parseLesson(text, "test.mdx")).toThrow(/"options" must have at least 2 entries/);
  });

  it("rejects a check question whose answer is out of range", () => {
    const text = VALID_TEXT.replace(
      'options: ["A", "B"]\n    answer: 1',
      'options: ["A", "B"]\n    answer: 5',
    );
    expect(() => parseLesson(text, "test.mdx")).toThrow(
      /"answer" must be an integer index into "options"/,
    );
  });

  it("rejects a check question missing why", () => {
    const text = VALID_TEXT.replace('why: "Because B."', "why: 42");
    expect(() => parseLesson(text, "test.mdx")).toThrow(/missing or non-string "why"/);
  });

  it("rejects an empty check array", () => {
    const text = VALID_TEXT.replace(/check:[\s\S]*?\n---/, "check: []\n---");
    expect(() => parseLesson(text, "test.mdx")).toThrow(/"check" must be a non-empty array/);
  });
});

describe("parseLessons", () => {
  it("rejects a duplicate slug across files", () => {
    const files = [
      { path: "a.mdx", text: VALID_TEXT },
      { path: "b.mdx", text: VALID_TEXT },
    ];
    expect(() => parseLessons(files)).toThrow(LessonError);
    expect(() => parseLessons(files)).toThrow(/duplicate lesson slug "scoring-engine"/);
  });

  it("parses multiple distinct lessons", () => {
    const other = VALID_TEXT.replace("slug: scoring-engine", "slug: other-lesson");
    const lessons = parseLessons([
      { path: "a.mdx", text: VALID_TEXT },
      { path: "b.mdx", text: other },
    ]);
    expect(lessons).toHaveLength(2);
    expect(lessons.map((l) => l.meta.slug)).toEqual(["scoring-engine", "other-lesson"]);
  });
});

describe("validateSkillRefs", () => {
  const lessons = parseLessons([{ path: "a.mdx", text: VALID_TEXT }]);

  it("passes when every domainId and skill id is a known taxonomy node", () => {
    expect(() => validateSkillRefs(lessons, KNOWN_NODES)).not.toThrow();
  });

  it("fails loudly on an unknown skill id", () => {
    const badNodes = KNOWN_NODES.filter(
      (n) => n.id !== "foundations.competition.scoring-engine",
    );
    expect(() => validateSkillRefs(lessons, badNodes)).toThrow(LessonError);
    expect(() => validateSkillRefs(lessons, badNodes)).toThrow(
      /unknown skill node id "foundations.competition.scoring-engine"/,
    );
  });

  it("fails loudly on an unknown domainId", () => {
    const badNodes = KNOWN_NODES.filter((n) => n.id !== "foundations");
    expect(() => validateSkillRefs(lessons, badNodes)).toThrow(/unknown domainId "foundations"/);
  });

  it("fails when a skill id refers to a non-leaf node", () => {
    const badNodes = KNOWN_NODES.map((n) =>
      n.id === "foundations.competition.scoring-engine" ? { ...n, kind: "CATEGORY" as const } : n,
    );
    expect(() => validateSkillRefs(lessons, badNodes)).toThrow(/is not a taxonomy skill/);
  });
});

describe("toLessonRow", () => {
  it("strips the check questions, keeping every other field", () => {
    const { meta } = parseLessons([{ path: "a.mdx", text: VALID_TEXT }])[0]!;
    const row = toLessonRow(meta);
    expect(row).toEqual({
      slug: "scoring-engine",
      title: "How the scoring engine behaves",
      domainId: "foundations",
      level: "FOUNDATIONS",
      minutes: 7,
      sortOrder: 1,
      published: false,
      skills: ["foundations.competition.scoring-engine"],
    });
    expect((row as { check?: unknown }).check).toBeUndefined();
  });
});
