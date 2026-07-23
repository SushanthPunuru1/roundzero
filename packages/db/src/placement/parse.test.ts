import { describe, expect, it } from "vitest";
import {
  PlacementError,
  parsePlacement,
  parsePlacementFile,
  toPublicQuestion,
  validatePlacementCoverage,
  validatePlacementRefs,
  type DesiredPlacementQuestion,
} from "./parse";
import type { KnownNode } from "../lessons/parse";

const VALID_YAML = `
version: 1
domain: linux
questions:
  - id: placement.linux.sudo-basics
    tier: foundations
    skillNodeId: linux.accounts.sudoers
    prompt: "What does sudo let a Linux user do?"
    options:
      - "Run a command with elevated (root) privileges"
      - "Permanently delete a file"
      - "Reboot the machine automatically"
    answer: 0
    why: "sudo grants temporary elevated privileges for one command."

  - id: placement.linux.root-login-risk
    tier: standard
    skillNodeId: linux.ssh.permitrootlogin
    prompt: "Why is direct root login over SSH risky?"
    options:
      - "It skips the extra privilege step between a compromised login and full control"
      - "It uses more bandwidth"
    answer: 0
    why: "Direct root login skips sudo's extra gate."
`;

describe("parsePlacementFile", () => {
  it("parses a valid file into DesiredPlacementQuestion rows", () => {
    const questions = parsePlacementFile(VALID_YAML, "linux.yaml");

    expect(questions).toHaveLength(2);
    expect(questions[0]).toEqual({
      id: "placement.linux.sudo-basics",
      domain: "linux",
      tier: "foundations",
      skillNodeId: "linux.accounts.sudoers",
      prompt: "What does sudo let a Linux user do?",
      options: [
        "Run a command with elevated (root) privileges",
        "Permanently delete a file",
        "Reboot the machine automatically",
      ],
      answer: 0,
      why: "sudo grants temporary elevated privileges for one command.",
      sortOrder: 0,
    });
    expect(questions[1]!.tier).toBe("standard");
    expect(questions[1]!.sortOrder).toBe(1);
  });

  it("rejects an unknown domain", () => {
    expect(() => parsePlacementFile("domain: solaris\nquestions: []", "bad.yaml")).toThrow(PlacementError);
  });

  it("rejects a missing/empty questions array", () => {
    expect(() => parsePlacementFile("domain: linux\nquestions: []", "bad.yaml")).toThrow(PlacementError);
  });

  it("rejects an unknown tier", () => {
    const bad = `
domain: linux
questions:
  - id: placement.linux.x
    tier: expert
    skillNodeId: linux.accounts.sudoers
    prompt: "?"
    options: ["a", "b"]
    answer: 0
    why: "why"
`;
    expect(() => parsePlacementFile(bad, "bad.yaml")).toThrow(/tier/);
  });

  it("rejects fewer than 2 options", () => {
    const bad = `
domain: linux
questions:
  - id: placement.linux.x
    tier: foundations
    skillNodeId: linux.accounts.sudoers
    prompt: "?"
    options: ["only one"]
    answer: 0
    why: "why"
`;
    expect(() => parsePlacementFile(bad, "bad.yaml")).toThrow(/options/);
  });

  it("rejects an answer index out of range", () => {
    const bad = `
domain: linux
questions:
  - id: placement.linux.x
    tier: foundations
    skillNodeId: linux.accounts.sudoers
    prompt: "?"
    options: ["a", "b"]
    answer: 5
    why: "why"
`;
    expect(() => parsePlacementFile(bad, "bad.yaml")).toThrow(/answer/);
  });
});

describe("parsePlacement", () => {
  it("rejects a duplicate id across files", () => {
    const files = [
      { path: "a.yaml", text: VALID_YAML },
      { path: "b.yaml", text: VALID_YAML },
    ];
    expect(() => parsePlacement(files)).toThrow(/duplicate placement question id/);
  });
});

describe("toPublicQuestion", () => {
  it("strips the answer index and why", () => {
    const [question] = parsePlacementFile(VALID_YAML, "linux.yaml");
    const pub = toPublicQuestion(question!);
    expect(pub).toEqual({
      id: "placement.linux.sudo-basics",
      domain: "linux",
      tier: "foundations",
      prompt: "What does sudo let a Linux user do?",
      options: question!.options,
    });
    expect(pub).not.toHaveProperty("answer");
    expect(pub).not.toHaveProperty("why");
  });
});

describe("validatePlacementRefs", () => {
  const knownNodes: KnownNode[] = [
    { id: "linux.accounts.sudoers", kind: "SKILL" },
    { id: "linux.accounts", kind: "CATEGORY" },
  ];

  it("passes when every skillNodeId resolves to a known leaf skill", () => {
    const questions = parsePlacementFile(VALID_YAML, "linux.yaml").filter(
      (q) => q.skillNodeId === "linux.accounts.sudoers",
    );
    expect(() => validatePlacementRefs(questions, knownNodes)).not.toThrow();
  });

  it("throws on an unknown skillNodeId", () => {
    const questions: DesiredPlacementQuestion[] = [
      {
        id: "placement.linux.x",
        domain: "linux",
        tier: "foundations",
        skillNodeId: "linux.nonexistent",
        prompt: "?",
        options: ["a", "b"],
        answer: 0,
        why: "why",
        sortOrder: 0,
      },
    ];
    expect(() => validatePlacementRefs(questions, knownNodes)).toThrow(/unknown skill node id/);
  });

  it("throws when skillNodeId resolves to a non-leaf node", () => {
    const questions: DesiredPlacementQuestion[] = [
      {
        id: "placement.linux.x",
        domain: "linux",
        tier: "foundations",
        skillNodeId: "linux.accounts",
        prompt: "?",
        options: ["a", "b"],
        answer: 0,
        why: "why",
        sortOrder: 0,
      },
    ];
    expect(() => validatePlacementRefs(questions, knownNodes)).toThrow(/not a taxonomy skill \(leaf\) node/);
  });
});

function makeQuestion(
  overrides: Partial<DesiredPlacementQuestion> & Pick<DesiredPlacementQuestion, "domain" | "tier">,
): DesiredPlacementQuestion {
  return {
    id: `placement.${overrides.domain}.${overrides.tier}.${Math.random()}`,
    skillNodeId: "linux.accounts.sudoers",
    prompt: "?",
    options: ["a", "b"],
    answer: 0,
    why: "why",
    sortOrder: 0,
    ...overrides,
  };
}

describe("validatePlacementCoverage", () => {
  const DOMAINS = ["foundations", "linux", "windows", "networking"] as const;

  function fullBank(): DesiredPlacementQuestion[] {
    const bank: DesiredPlacementQuestion[] = [];
    for (const domain of DOMAINS) {
      for (let i = 0; i < 3; i++) bank.push(makeQuestion({ domain, tier: "foundations" }));
      bank.push(makeQuestion({ domain, tier: "standard" }));
      bank.push(makeQuestion({ domain, tier: "advanced" }));
    }
    return bank;
  }

  it("passes a bank with 3 foundations + 1 standard + 1 advanced per domain", () => {
    expect(() => validatePlacementCoverage(fullBank())).not.toThrow();
  });

  it("throws when a domain has fewer than 3 foundations-tier questions", () => {
    const bank = fullBank().filter(
      (q) => !(q.domain === "linux" && q.tier === "foundations"),
    );
    // put back 2 of the 3 removed
    bank.push(makeQuestion({ domain: "linux", tier: "foundations" }));
    bank.push(makeQuestion({ domain: "linux", tier: "foundations" }));
    expect(() => validatePlacementCoverage(bank)).toThrow(/needs at least 3 foundations-tier/);
  });

  it("throws when a domain is missing a standard-tier question", () => {
    const bank = fullBank().filter((q) => !(q.domain === "windows" && q.tier === "standard"));
    expect(() => validatePlacementCoverage(bank)).toThrow(/needs at least 1 standard-tier/);
  });

  it("throws when a domain is missing an advanced-tier question", () => {
    const bank = fullBank().filter((q) => !(q.domain === "networking" && q.tier === "advanced"));
    expect(() => validatePlacementCoverage(bank)).toThrow(/needs at least 1 advanced-tier/);
  });

  it("throws when a whole domain is absent", () => {
    const bank = fullBank().filter((q) => q.domain !== "windows");
    expect(() => validatePlacementCoverage(bank)).toThrow(/"windows"/);
  });
});
