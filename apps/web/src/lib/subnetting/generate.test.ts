import { describe, expect, it } from "vitest";
import { computeSubnet, parseIp, vlsmFit } from "./math";
import { PROBLEM_TYPES, generateProblem, generateRound, makeRng } from "./generate";

describe("makeRng", () => {
  it("is deterministic: same seed produces the same sequence", () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const rng = makeRng(1);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("different seeds diverge", () => {
    const a = makeRng(1)();
    const b = makeRng(2)();
    expect(a).not.toBe(b);
  });
});

describe("generateProblem", () => {
  it("respects an explicit type", () => {
    const rng = makeRng(7);
    for (const type of PROBLEM_TYPES) {
      expect(generateProblem(rng, type).type).toBe(type);
    }
  });

  it("every generated IP is well-formed", () => {
    const rng = makeRng(42);
    for (let i = 0; i < 200; i++) {
      const problem = generateProblem(rng);
      expect(parseIp(problem.ip)).not.toBeNull();
    }
  });

  it("cidr-breakdown / mask-breakdown / which-subnet always have a usable host range", () => {
    const rng = makeRng(99);
    for (let i = 0; i < 200; i++) {
      const type = PROBLEM_TYPES[i % 3]!; // cycles the three non-vlsm types
      const problem = generateProblem(rng, type);
      const facts = computeSubnet(problem.ip, problem.prefix);
      expect(facts.usableHosts).toBeGreaterThanOrEqual(2);
      expect(facts.firstHost).not.toBeNull();
      expect(facts.lastHost).not.toBeNull();
    }
  });

  it("vlsm-fit carries a requiredHosts that its prefix actually satisfies minimally", () => {
    const rng = makeRng(5);
    for (let i = 0; i < 100; i++) {
      const problem = generateProblem(rng, "vlsm-fit");
      expect(problem.requiredHosts).toBeGreaterThan(0);
      const fit = vlsmFit(problem.requiredHosts!);
      expect(fit).not.toBeNull();
      expect(fit!.prefix).toBe(problem.prefix);
    }
  });
});

describe("generateRound", () => {
  it("is deterministic: same seed produces an identical round", () => {
    const roundA = generateRound(2024, 5);
    const roundB = generateRound(2024, 5);
    expect(roundA).toEqual(roundB);
  });

  it("different seeds produce different rounds", () => {
    const roundA = generateRound(1, 5);
    const roundB = generateRound(2, 5);
    expect(roundA).not.toEqual(roundB);
  });

  it("produces exactly `count` problems", () => {
    expect(generateRound(1, 5)).toHaveLength(5);
    expect(generateRound(1, 1)).toHaveLength(1);
    expect(generateRound(1, 20)).toHaveLength(20);
  });

  it("honors a type filter", () => {
    const round = generateRound(3, 30, ["vlsm-fit"]);
    expect(round.every((p) => p.type === "vlsm-fit")).toBe(true);
  });
});
