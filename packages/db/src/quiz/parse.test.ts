import { describe, expect, it } from "vitest";
import { QuizError, parseQuiz, parseQuizFile, toQuizRow, validateQuizRefs } from "./parse";
import type { KnownNode } from "../lessons/parse";

const VALID_YAML = `
version: 1
quizId: networking
questions:
  - id: networking-quiz.q.port-rdp
    category: ports
    skillNodeId: networking.fundamentals.ports
    prompt: "What port does RDP use?"
    answer: "3389"
    accepts: ["3389"]
    case_sensitive: false
    technique: "N/A"
    why: "3389 is the classic RDP port."

  - id: networking-quiz.q.save-config
    category: ios-commands
    skillNodeId: networking.devices.ios-basics
    prompt: "What command saves running-config to startup-config?"
    answer: "copy running-config startup-config"
    accepts: ["copy running-config startup-config", "copy run start"]
    why: "Nothing saves automatically on IOS."
`;

describe("parseQuizFile", () => {
  it("parses a valid file into DesiredQuizQuestion rows", () => {
    const questions = parseQuizFile(VALID_YAML, "ports.yaml");

    expect(questions).toHaveLength(2);
    expect(questions[0]).toEqual({
      id: "networking-quiz.q.port-rdp",
      quizId: "networking",
      category: "ports",
      skillNodeId: "networking.fundamentals.ports",
      prompt: "What port does RDP use?",
      given: null,
      answer: "3389",
      accepts: ["3389"],
      caseSensitive: false,
      stripTrailingSlash: false,
      technique: "N/A",
      why: "3389 is the classic RDP port.",
      sortOrder: 0,
    });
    expect(questions[1]!.sortOrder).toBe(1);
    expect(questions[1]!.category).toBe("ios-commands");
  });

  it("defaults given/technique to null, accepts to [], case_sensitive/strip_trailing_slash to false when omitted", () => {
    const questions = parseQuizFile(VALID_YAML, "ports.yaml");
    const second = questions[1]!;
    expect(second.given).toBeNull();
    expect(second.technique).toBeNull();
    expect(second.caseSensitive).toBe(false);
    expect(second.stripTrailingSlash).toBe(false);
  });

  it("rejects an empty/non-mapping file", () => {
    expect(() => parseQuizFile("", "f.yaml")).toThrow(QuizError);
    expect(() => parseQuizFile("", "f.yaml")).toThrow(/empty or not a YAML mapping/);
  });

  it("rejects a missing quizId", () => {
    const yamlText = VALID_YAML.replace("quizId: networking\n", "");
    expect(() => parseQuizFile(yamlText, "f.yaml")).toThrow(/missing or non-string "quizId"/);
  });

  it("rejects a missing top-level questions array", () => {
    expect(() => parseQuizFile("version: 1\nquizId: networking", "f.yaml")).toThrow(
      /missing top-level "questions" array/,
    );
  });

  it("rejects a malformed category", () => {
    const yamlText = VALID_YAML.replace("category: ports", "category: Not_Valid");
    expect(() => parseQuizFile(yamlText, "f.yaml")).toThrow(/"category" must be a kebab-case string/);
  });

  it("rejects a malformed skillNodeId", () => {
    const yamlText = VALID_YAML.replace(
      "skillNodeId: networking.fundamentals.ports",
      "skillNodeId: Not Valid!",
    );
    expect(() => parseQuizFile(yamlText, "f.yaml")).toThrow(/not a well-formed dotted lowercase id/);
  });

  it("rejects a missing prompt", () => {
    const yamlText = VALID_YAML.replace('    prompt: "What port does RDP use?"\n', "");
    expect(() => parseQuizFile(yamlText, "f.yaml")).toThrow(/missing or non-string "prompt"/);
  });

  it("rejects a missing answer", () => {
    const yamlText = VALID_YAML.replace('    answer: "3389"\n', "");
    expect(() => parseQuizFile(yamlText, "f.yaml")).toThrow(/missing or non-string "answer"/);
  });

  it("rejects a non-array accepts", () => {
    const yamlText = VALID_YAML.replace('accepts: ["3389"]', "accepts: nope");
    expect(() => parseQuizFile(yamlText, "f.yaml")).toThrow(/"accepts" must be an array of strings/);
  });
});

describe("parseQuiz", () => {
  it("flattens multiple files and rejects a duplicate id across files", () => {
    const files = [
      { path: "a.yaml", text: VALID_YAML },
      { path: "b.yaml", text: VALID_YAML },
    ];
    expect(() => parseQuiz(files)).toThrow(/duplicate quiz question id "networking-quiz.q.port-rdp"/);
  });

  it("parses a batch across files with unique ids", () => {
    const second = VALID_YAML.replace(
      "networking-quiz.q.port-rdp",
      "networking-quiz.q.port-other",
    ).replace("networking-quiz.q.save-config", "networking-quiz.q.save-other");
    const files = [
      { path: "a.yaml", text: VALID_YAML },
      { path: "b.yaml", text: second },
    ];
    expect(parseQuiz(files)).toHaveLength(4);
  });
});

describe("toQuizRow", () => {
  it("drops the answer-key fields", () => {
    const [question] = parseQuizFile(VALID_YAML, "ports.yaml");
    const row = toQuizRow(question!);
    expect(row).toEqual({
      id: "networking-quiz.q.port-rdp",
      quizId: "networking",
      category: "ports",
      skillNodeId: "networking.fundamentals.ports",
      prompt: "What port does RDP use?",
      given: null,
      sortOrder: 0,
    });
    expect(row).not.toHaveProperty("answer");
    expect(row).not.toHaveProperty("accepts");
    expect(row).not.toHaveProperty("technique");
    expect(row).not.toHaveProperty("why");
  });
});

describe("validateQuizRefs", () => {
  const knownNodes: KnownNode[] = [
    { id: "networking.fundamentals.ports", kind: "SKILL" },
    { id: "networking.devices.ios-basics", kind: "SKILL" },
    { id: "networking.fundamentals", kind: "CATEGORY" },
  ];

  it("accepts questions whose refs all resolve to leaf skills", () => {
    const questions = parseQuizFile(VALID_YAML, "f.yaml");
    expect(() => validateQuizRefs(questions, knownNodes)).not.toThrow();
  });

  it("rejects an unknown skill node id", () => {
    const questions = parseQuizFile(VALID_YAML, "f.yaml");
    questions[0]!.skillNodeId = "networking.fundamentals.nonexistent";
    expect(() => validateQuizRefs(questions, knownNodes)).toThrow(
      /unknown skill node id "networking.fundamentals.nonexistent"/,
    );
  });

  it("rejects a skillNodeId that resolves to a non-leaf node", () => {
    const questions = parseQuizFile(VALID_YAML, "f.yaml");
    questions[0]!.skillNodeId = "networking.fundamentals";
    expect(() => validateQuizRefs(questions, knownNodes)).toThrow(
      /is not a taxonomy skill \(leaf\) node/,
    );
  });
});
