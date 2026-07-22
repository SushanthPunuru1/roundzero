import { describe, expect, it } from "vitest";
import type { Problem } from "./generate";
import { explainProblem } from "./explain";

const cidrProblem: Problem = {
  type: "cidr-breakdown",
  ip: "192.168.10.37",
  prefix: 26,
  mask: "255.255.255.192",
};

describe("explainProblem", () => {
  it("produces correctly formatted binary strings", () => {
    const solution = explainProblem(cidrProblem);
    expect(solution.ipBinary).toBe("11000000.10101000.00001010.00100101");
    expect(solution.maskBinary).toBe("11111111.11111111.11111111.11000000");
    expect(solution.networkBinary).toBe("11000000.10101000.00001010.00000000");
    expect(solution.broadcastBinary).toBe("11000000.10101000.00001010.00111111");
    expect(solution.hostBits).toBe(6);
    expect(solution.blockSize).toBe(64);
  });

  it("includes a usable-range step when hosts exist", () => {
    const solution = explainProblem(cidrProblem);
    expect(solution.steps.some((s) => s.includes("Usable host range"))).toBe(true);
    expect(solution.edgeCaseNote).toBeUndefined();
  });

  it("omits the usable-range step and adds an edge-case note on /31", () => {
    const problem: Problem = { type: "cidr-breakdown", ip: "10.10.10.10", prefix: 31, mask: "255.255.255.254" };
    const solution = explainProblem(problem);
    expect(solution.steps.some((s) => s.includes("Usable host range"))).toBe(false);
    expect(solution.edgeCaseNote).toContain("RFC 3021");
  });

  it("adds an edge-case note on /32", () => {
    const problem: Problem = { type: "cidr-breakdown", ip: "10.10.10.10", prefix: 32, mask: "255.255.255.255" };
    const solution = explainProblem(problem);
    expect(solution.edgeCaseNote).toContain("single host");
  });

  it("adds a VLSM-specific step naming the required host count", () => {
    const problem: Problem = {
      type: "vlsm-fit",
      ip: "10.0.0.0",
      prefix: 26,
      mask: "255.255.255.192",
      requiredHosts: 50,
    };
    const solution = explainProblem(problem);
    expect(solution.steps.some((s) => s.includes("Needed 50 usable hosts"))).toBe(true);
  });

  it("throws on an invalid ip", () => {
    const problem: Problem = { type: "cidr-breakdown", ip: "not-an-ip", prefix: 24, mask: "255.255.255.0" };
    expect(() => explainProblem(problem)).toThrow();
  });
});
