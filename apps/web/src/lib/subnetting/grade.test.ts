import { describe, expect, it } from "vitest";
import type { Problem } from "./generate";
import { FIELDS_BY_TYPE, gradeProblem, gradeRound } from "./grade";

const cidrProblem: Problem = {
  type: "cidr-breakdown",
  ip: "192.168.10.37",
  prefix: 26,
  mask: "255.255.255.192",
};

const maskProblem: Problem = {
  type: "mask-breakdown",
  ip: "192.168.10.37",
  prefix: 26,
  mask: "255.255.255.192",
};

const vlsmProblem: Problem = {
  type: "vlsm-fit",
  ip: "10.0.0.0",
  prefix: 26,
  mask: "255.255.255.192",
  requiredHosts: 50,
};

const whichSubnetProblem: Problem = {
  type: "which-subnet",
  ip: "192.168.10.37",
  prefix: 26,
  mask: "255.255.255.192",
};

describe("gradeProblem — cidr-breakdown", () => {
  it("marks every field correct on an exact answer", () => {
    const result = gradeProblem(cidrProblem, {
      network: "192.168.10.0",
      broadcast: "192.168.10.63",
      firstHost: "192.168.10.1",
      lastHost: "192.168.10.62",
      usableHosts: "62",
      mask: "255.255.255.192",
    });
    expect(result.correct).toBe(true);
    expect(Object.values(result.fields)).toEqual([true, true, true, true, true, true]);
  });

  it("flags exactly the one wrong field and leaves the rest correct", () => {
    const result = gradeProblem(cidrProblem, {
      network: "192.168.10.0",
      broadcast: "192.168.10.63",
      firstHost: "192.168.10.1",
      lastHost: "192.168.10.99", // wrong
      usableHosts: "62",
      mask: "255.255.255.192",
    });
    expect(result.correct).toBe(false);
    expect(result.fields.lastHost).toBe(false);
    expect(result.fields.network).toBe(true);
    expect(result.fields.broadcast).toBe(true);
    expect(result.fields.firstHost).toBe(true);
    expect(result.fields.usableHosts).toBe(true);
    expect(result.fields.mask).toBe(true);
  });

  it("tolerates a leading-zero IP octet as the same value", () => {
    const result = gradeProblem(cidrProblem, {
      network: "192.168.010.0",
      broadcast: "192.168.10.63",
      firstHost: "192.168.10.1",
      lastHost: "192.168.10.62",
      usableHosts: "62",
      mask: "255.255.255.192",
    });
    expect(result.fields.network).toBe(true);
  });

  it("tolerates whitespace around a numeric field", () => {
    const result = gradeProblem(cidrProblem, {
      network: "192.168.10.0",
      broadcast: "192.168.10.63",
      firstHost: "192.168.10.1",
      lastHost: "192.168.10.62",
      usableHosts: " 62 ",
      mask: "255.255.255.192",
    });
    expect(result.fields.usableHosts).toBe(true);
  });

  it("rejects a malformed IP outright", () => {
    const result = gradeProblem(cidrProblem, {
      network: "not-an-ip",
      broadcast: "192.168.10.63",
      firstHost: "192.168.10.1",
      lastHost: "192.168.10.62",
      usableHosts: "62",
      mask: "255.255.255.192",
    });
    expect(result.fields.network).toBe(false);
  });

  it("treats a missing field as incorrect", () => {
    const result = gradeProblem(cidrProblem, {
      network: "192.168.10.0",
      broadcast: "192.168.10.63",
    });
    expect(result.correct).toBe(false);
    expect(result.fields.firstHost).toBe(false);
  });
});

describe("gradeProblem — mask-breakdown", () => {
  it("accepts a CIDR answer with or without the leading slash", () => {
    const answers = {
      network: "192.168.10.0",
      broadcast: "192.168.10.63",
      firstHost: "192.168.10.1",
      lastHost: "192.168.10.62",
      usableHosts: "62",
    };
    expect(gradeProblem(maskProblem, { ...answers, cidr: "/26" }).correct).toBe(true);
    expect(gradeProblem(maskProblem, { ...answers, cidr: "26" }).correct).toBe(true);
    expect(gradeProblem(maskProblem, { ...answers, cidr: "27" }).fields.cidr).toBe(false);
  });
});

describe("gradeProblem — vlsm-fit", () => {
  it("grades the derived prefix/mask/usable-host fields", () => {
    const result = gradeProblem(vlsmProblem, {
      cidr: "/26",
      mask: "255.255.255.192",
      usableHosts: "62",
    });
    expect(result.correct).toBe(true);
  });

  it("only asks for the vlsm-fit field set", () => {
    expect(FIELDS_BY_TYPE["vlsm-fit"]).toEqual(["cidr", "mask", "usableHosts"]);
  });
});

describe("gradeProblem — which-subnet", () => {
  it("only asks for the network address", () => {
    expect(FIELDS_BY_TYPE["which-subnet"]).toEqual(["network"]);
    expect(gradeProblem(whichSubnetProblem, { network: "192.168.10.0" }).correct).toBe(true);
    expect(gradeProblem(whichSubnetProblem, { network: "192.168.10.1" }).correct).toBe(false);
  });
});

describe("gradeRound", () => {
  it("computes accuracy across a mixed round", () => {
    const problems = [cidrProblem, whichSubnetProblem];
    const answers = [
      {
        network: "192.168.10.0",
        broadcast: "192.168.10.63",
        firstHost: "192.168.10.1",
        lastHost: "192.168.10.62",
        usableHosts: "62",
        mask: "255.255.255.192",
      },
      { network: "wrong" },
    ];
    const result = gradeRound(problems, answers);
    expect(result).toEqual({ correct: 1, total: 2, accuracy: 50 });
  });

  it("is 0 for an all-wrong round and 100 for an all-correct round", () => {
    expect(gradeRound([whichSubnetProblem], [{ network: "wrong" }]).accuracy).toBe(0);
    expect(gradeRound([whichSubnetProblem], [{ network: "192.168.10.0" }]).accuracy).toBe(100);
  });
});
