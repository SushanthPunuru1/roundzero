import { describe, expect, it } from "vitest";
import {
  ForensicsError,
  parseForensics,
  parseForensicsFile,
  toForensicsRow,
  validateForensicsRefs,
} from "./parse";
import type { KnownNode } from "../lessons/parse";

const VALID_YAML = `
version: 1
questions:
  - id: forensics.q.base64-harden
    archetype: decoding
    skillNodeId: forensics.core.decoding
    prompt: "Decode the string."
    given: "aGFyZGVuIGV2ZXJ5dGhpbmc="
    answer: "harden everything"
    accepts: ["harden everything"]
    case_sensitive: false
    strip_trailing_slash: false
    technique: "base64 -d"
    why: "Base64 hides messages in plain sight."

  - id: forensics.q.mp3-prohibited-path
    archetype: file-hunting
    skillNodeId: forensics.core.file-hunting
    prompt: "Find the prohibited directory."
    given: "/home/desmond/Music/hype.mp3"
    answer: "/home/desmond/Music"
    case_sensitive: false
    technique: "find / -iname '*.mp3'"
    why: "The answer is the containing directory."
`;

describe("parseForensicsFile", () => {
  it("parses a valid file into DesiredForensicsQuestion rows", () => {
    const questions = parseForensicsFile(VALID_YAML, "decoding.yaml");

    expect(questions).toHaveLength(2);
    expect(questions[0]).toEqual({
      id: "forensics.q.base64-harden",
      archetype: "DECODING",
      skillNodeId: "forensics.core.decoding",
      prompt: "Decode the string.",
      given: "aGFyZGVuIGV2ZXJ5dGhpbmc=",
      answer: "harden everything",
      accepts: ["harden everything"],
      caseSensitive: false,
      stripTrailingSlash: false,
      technique: "base64 -d",
      why: "Base64 hides messages in plain sight.",
      sortOrder: 0,
    });
    expect(questions[1]!.sortOrder).toBe(1);
    expect(questions[1]!.archetype).toBe("FILE_HUNTING");
  });

  it("defaults accepts to [] and strip_trailing_slash to false when omitted", () => {
    const questions = parseForensicsFile(VALID_YAML, "decoding.yaml");
    expect(questions[1]!.accepts).toEqual([]);
    expect(questions[1]!.stripTrailingSlash).toBe(false);
  });

  it("rejects an empty/non-mapping file", () => {
    expect(() => parseForensicsFile("", "f.yaml")).toThrow(ForensicsError);
    expect(() => parseForensicsFile("", "f.yaml")).toThrow(/empty or not a YAML mapping/);
  });

  it("rejects a missing top-level questions array", () => {
    expect(() => parseForensicsFile("version: 1", "f.yaml")).toThrow(
      /missing top-level "questions" array/,
    );
  });

  it("rejects an unknown archetype", () => {
    const yamlText = VALID_YAML.replace("archetype: decoding", "archetype: trivia");
    expect(() => parseForensicsFile(yamlText, "f.yaml")).toThrow(/"archetype" must be one of/);
  });

  it("rejects a missing case_sensitive", () => {
    const yamlText = VALID_YAML.replace("    case_sensitive: false\n", "");
    expect(() => parseForensicsFile(yamlText, "f.yaml")).toThrow(
      /"case_sensitive" must be a boolean/,
    );
  });

  it("rejects a malformed skillNodeId", () => {
    const yamlText = VALID_YAML.replace(
      "skillNodeId: forensics.core.decoding",
      "skillNodeId: Not Valid!",
    );
    expect(() => parseForensicsFile(yamlText, "f.yaml")).toThrow(
      /not a well-formed dotted lowercase id/,
    );
  });

  it("rejects a missing prompt", () => {
    const yamlText = VALID_YAML.replace('    prompt: "Decode the string."\n', "");
    expect(() => parseForensicsFile(yamlText, "f.yaml")).toThrow(/missing or non-string "prompt"/);
  });

  it("rejects a missing answer", () => {
    const yamlText = VALID_YAML.replace('    answer: "harden everything"\n', "");
    expect(() => parseForensicsFile(yamlText, "f.yaml")).toThrow(/missing or non-string "answer"/);
  });

  it("rejects a non-array accepts", () => {
    const yamlText = VALID_YAML.replace('accepts: ["harden everything"]', "accepts: nope");
    expect(() => parseForensicsFile(yamlText, "f.yaml")).toThrow(
      /"accepts" must be an array of strings/,
    );
  });
});

describe("parseForensics", () => {
  it("flattens multiple files and rejects a duplicate id across files", () => {
    const files = [
      { path: "a.yaml", text: VALID_YAML },
      { path: "b.yaml", text: VALID_YAML },
    ];
    expect(() => parseForensics(files)).toThrow(
      /duplicate forensics question id "forensics.q.base64-harden"/,
    );
  });

  it("parses a batch across files with unique ids", () => {
    const second = VALID_YAML.replace(
      "forensics.q.base64-harden",
      "forensics.q.base64-other",
    ).replace("forensics.q.mp3-prohibited-path", "forensics.q.mp3-other");
    const files = [
      { path: "a.yaml", text: VALID_YAML },
      { path: "b.yaml", text: second },
    ];
    expect(parseForensics(files)).toHaveLength(4);
  });
});

describe("toForensicsRow", () => {
  it("drops the answer-key fields", () => {
    const [question] = parseForensicsFile(VALID_YAML, "decoding.yaml");
    const row = toForensicsRow(question!);
    expect(row).toEqual({
      id: "forensics.q.base64-harden",
      archetype: "DECODING",
      skillNodeId: "forensics.core.decoding",
      prompt: "Decode the string.",
      given: "aGFyZGVuIGV2ZXJ5dGhpbmc=",
      sortOrder: 0,
    });
    expect(row).not.toHaveProperty("answer");
    expect(row).not.toHaveProperty("accepts");
    expect(row).not.toHaveProperty("technique");
    expect(row).not.toHaveProperty("why");
  });
});

describe("validateForensicsRefs", () => {
  const knownNodes: KnownNode[] = [
    { id: "forensics.core.decoding", kind: "SKILL" },
    { id: "forensics.core.file-hunting", kind: "SKILL" },
    { id: "forensics.core", kind: "CATEGORY" },
  ];

  it("accepts questions whose refs all resolve to leaf skills", () => {
    const questions = parseForensicsFile(VALID_YAML, "f.yaml");
    expect(() => validateForensicsRefs(questions, knownNodes)).not.toThrow();
  });

  it("rejects an unknown skill node id", () => {
    const questions = parseForensicsFile(VALID_YAML, "f.yaml");
    questions[0]!.skillNodeId = "forensics.core.nonexistent";
    expect(() => validateForensicsRefs(questions, knownNodes)).toThrow(
      /unknown skill node id "forensics.core.nonexistent"/,
    );
  });

  it("rejects a skillNodeId that resolves to a non-leaf node", () => {
    const questions = parseForensicsFile(VALID_YAML, "f.yaml");
    questions[0]!.skillNodeId = "forensics.core";
    expect(() => validateForensicsRefs(questions, knownNodes)).toThrow(
      /is not a taxonomy skill \(leaf\) node/,
    );
  });
});
