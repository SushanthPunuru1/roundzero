import { describe, expect, it } from "vitest";
import {
  ChecklistError,
  parseChecklist,
  parseChecklists,
  validateChecklistRefs,
  type DesiredChecklistTemplate,
} from "./parse";
import type { KnownNode } from "../lessons/parse";

const VALID_YAML = `
id: linux-core
os: LINUX
seasonId: cp-19
version: 1
title: Linux core hardening

items:
  - id: linux.setup.readme-forensics
    skillNodeId: foundations.competition.readme
    sortOrder: 10
    action: "Read the README first."
    why: "Fixing a vuln can destroy evidence."
    lessonSlug: reading-a-readme
    commands:
      all: "# no commands"

  - id: linux.pam.pwquality
    skillNodeId: linux.pam.pwquality
    sortOrder: 20
    action: "Enforce password quality."
    why: "Password-strength policy is scored."
    caution: "Locking yourself out of sudo is common here."
    commands:
      ubuntu22: "grep pam_pwquality /etc/pam.d/common-password"
      ubuntu24: "grep pam_pwquality /etc/pam.d/common-password"
`;

describe("parseChecklist", () => {
  it("parses a valid template into a DesiredChecklistTemplate", () => {
    const template = parseChecklist(VALID_YAML, "linux-core.yaml");

    expect(template.id).toBe("linux-core");
    expect(template.os).toBe("LINUX");
    expect(template.seasonId).toBe("cp-19");
    expect(template.version).toBe(1);
    expect(template.title).toBe("Linux core hardening");
    expect(template.items).toHaveLength(2);

    expect(template.items[0]).toEqual({
      id: "linux.setup.readme-forensics",
      templateId: "linux-core",
      skillNodeId: "foundations.competition.readme",
      sortOrder: 10,
      action: "Read the README first.",
      why: "Fixing a vuln can destroy evidence.",
      commands: { all: "# no commands" },
      lessonSlug: "reading-a-readme",
      caution: null,
    });

    expect(template.items[1]).toEqual({
      id: "linux.pam.pwquality",
      templateId: "linux-core",
      skillNodeId: "linux.pam.pwquality",
      sortOrder: 20,
      action: "Enforce password quality.",
      why: "Password-strength policy is scored.",
      commands: {
        ubuntu22: "grep pam_pwquality /etc/pam.d/common-password",
        ubuntu24: "grep pam_pwquality /etc/pam.d/common-password",
      },
      lessonSlug: null,
      caution: "Locking yourself out of sudo is common here.",
    });
  });

  it("rejects a bad os value", () => {
    const yamlText = VALID_YAML.replace("os: LINUX", "os: MACOS");
    expect(() => parseChecklist(yamlText, "x.yaml")).toThrow(ChecklistError);
    expect(() => parseChecklist(yamlText, "x.yaml")).toThrow(/"os" must be one of/);
  });

  it("rejects a missing/empty title", () => {
    const yamlText = VALID_YAML.replace("title: Linux core hardening", "title: ''");
    expect(() => parseChecklist(yamlText, "x.yaml")).toThrow(/missing or non-string "title"/);
  });

  it("rejects a missing action", () => {
    const yamlText = VALID_YAML.replace(
      'action: "Read the README first."',
      "",
    );
    expect(() => parseChecklist(yamlText, "x.yaml")).toThrow(/missing or non-string "action"/);
  });

  it("rejects a missing why", () => {
    const yamlText = VALID_YAML.replace(
      'why: "Fixing a vuln can destroy evidence."',
      "",
    );
    expect(() => parseChecklist(yamlText, "x.yaml")).toThrow(/missing or non-string "why"/);
  });

  it("rejects a malformed item id", () => {
    const yamlText = VALID_YAML.replace(
      "id: linux.setup.readme-forensics",
      "id: Linux.Setup!",
    );
    expect(() => parseChecklist(yamlText, "x.yaml")).toThrow(
      /not a well-formed dotted lowercase id/,
    );
  });

  it("rejects a malformed skillNodeId", () => {
    const yamlText = VALID_YAML.replace(
      "skillNodeId: linux.pam.pwquality",
      "skillNodeId: Not Valid!",
    );
    expect(() => parseChecklist(yamlText, "x.yaml")).toThrow(
      /not a well-formed dotted lowercase id/,
    );
  });

  it("rejects empty commands", () => {
    const yamlText = VALID_YAML.replace('commands:\n      all: "# no commands"', "commands: {}");
    expect(() => parseChecklist(yamlText, "x.yaml")).toThrow(
      /"commands" must have at least one entry/,
    );
  });

  it("rejects a non-string command value", () => {
    const yamlText = VALID_YAML.replace(
      'commands:\n      all: "# no commands"',
      "commands:\n      all: 42",
    );
    expect(() => parseChecklist(yamlText, "x.yaml")).toThrow(
      /commands\["all"\] must be a non-empty string/,
    );
  });

  it("rejects a duplicate item id within a template", () => {
    const yamlText = VALID_YAML.replace(
      "id: linux.pam.pwquality\n    skillNodeId: linux.pam.pwquality",
      "id: linux.setup.readme-forensics\n    skillNodeId: linux.pam.pwquality",
    );
    expect(() => parseChecklist(yamlText, "x.yaml")).toThrow(/duplicate item id/);
  });

  it("rejects a file missing top-level items", () => {
    expect(() =>
      parseChecklist("id: x\nos: LINUX\nseasonId: cp-19\nversion: 1\ntitle: X", "x.yaml"),
    ).toThrow(/"items" must be a non-empty array/);
  });
});

describe("parseChecklists", () => {
  it("rejects duplicate template ids across files", () => {
    const files = [
      { path: "a.yaml", text: VALID_YAML },
      { path: "b.yaml", text: VALID_YAML },
    ];
    expect(() => parseChecklists(files)).toThrow(/duplicate checklist template id "linux-core"/);
  });

  it("parses multiple distinct templates", () => {
    const otherYaml = VALID_YAML.replace("id: linux-core", "id: windows-core").replace(
      "os: LINUX",
      "os: WINDOWS",
    );
    const files = [
      { path: "a.yaml", text: VALID_YAML },
      { path: "b.yaml", text: otherYaml },
    ];
    const templates = parseChecklists(files);
    expect(templates.map((t) => t.id)).toEqual(["linux-core", "windows-core"]);
  });
});

describe("validateChecklistRefs", () => {
  const knownNodes: KnownNode[] = [
    { id: "foundations.competition.readme", kind: "SKILL" },
    { id: "linux.pam.pwquality", kind: "SKILL" },
    { id: "linux.pam", kind: "CATEGORY" },
  ];
  const knownLessonSlugs = new Set(["reading-a-readme"]);
  const knownSeasonIds = new Set(["cp-19"]);

  function template(): DesiredChecklistTemplate {
    return parseChecklist(VALID_YAML, "linux-core.yaml");
  }

  it("accepts a template whose refs all resolve", () => {
    expect(() =>
      validateChecklistRefs([template()], knownNodes, knownLessonSlugs, knownSeasonIds),
    ).not.toThrow();
  });

  it("rejects an unknown skill node id", () => {
    const t = template();
    t.items[1]!.skillNodeId = "linux.pam.nonexistent";
    expect(() =>
      validateChecklistRefs([t], knownNodes, knownLessonSlugs, knownSeasonIds),
    ).toThrow(/unknown skill node id "linux.pam.nonexistent"/);
  });

  it("rejects a skillNodeId that resolves to a non-leaf node", () => {
    const t = template();
    t.items[1]!.skillNodeId = "linux.pam";
    expect(() =>
      validateChecklistRefs([t], knownNodes, knownLessonSlugs, knownSeasonIds),
    ).toThrow(/is not a taxonomy skill \(leaf\) node/);
  });

  it("rejects an unknown lesson slug", () => {
    const t = template();
    t.items[0]!.lessonSlug = "nonexistent-lesson";
    expect(() =>
      validateChecklistRefs([t], knownNodes, knownLessonSlugs, knownSeasonIds),
    ).toThrow(/unknown lesson slug "nonexistent-lesson"/);
  });

  it("rejects an unknown season id", () => {
    const t = template();
    t.seasonId = "cp-99";
    expect(() =>
      validateChecklistRefs([t], knownNodes, knownLessonSlugs, knownSeasonIds),
    ).toThrow(/unknown seasonId "cp-99"/);
  });
});
