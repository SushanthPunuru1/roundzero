import { describe, expect, it } from "vitest";
import {
  SubnetMathError,
  computeSubnet,
  formatIp,
  ipToBinary,
  maskFromPrefix,
  parseIp,
  prefixFromMask,
  vlsmFit,
} from "./math";

describe("parseIp", () => {
  it.each([
    ["192.168.10.37", 3232238117],
    ["0.0.0.0", 0],
    ["255.255.255.255", 4294967295],
    ["  10.0.0.1  ", 167772161],
    ["192.168.010.5", 3232238085], // leading zero parses as decimal, never octal
  ])("parses %s", (input, expected) => {
    expect(parseIp(input)).toBe(expected);
  });

  it.each([
    ["192.168.10"],
    ["192.168.10.256"],
    ["192.168.10.-1"],
    ["192.168.10.a"],
    ["192.168.10.5.1"],
    [""],
    ["...."],
  ])("rejects %s", (input) => {
    expect(parseIp(input)).toBeNull();
  });

  it("round-trips through formatIp", () => {
    expect(formatIp(parseIp("192.168.10.37")!)).toBe("192.168.10.37");
  });
});

describe("formatIp / ipToBinary", () => {
  it("formats a uint32 as dotted decimal", () => {
    expect(formatIp(3232238117)).toBe("192.168.10.37");
    expect(formatIp(0)).toBe("0.0.0.0");
    expect(formatIp(4294967295)).toBe("255.255.255.255");
  });

  it("formats a uint32 as dotted binary", () => {
    expect(ipToBinary(parseIp("192.168.10.37")!)).toBe(
      "11000000.10101000.00001010.00100101",
    );
  });
});

describe("maskFromPrefix / prefixFromMask", () => {
  it.each([
    [0, "0.0.0.0"],
    [1, "128.0.0.0"],
    [8, "255.0.0.0"],
    [20, "255.255.240.0"],
    [24, "255.255.255.0"],
    [25, "255.255.255.128"],
    [26, "255.255.255.192"],
    [27, "255.255.255.224"],
    [28, "255.255.255.240"],
    [29, "255.255.255.248"],
    [30, "255.255.255.252"],
    [31, "255.255.255.254"],
    [32, "255.255.255.255"],
  ])("prefix /%d -> mask %s", (prefix, mask) => {
    expect(formatIp(maskFromPrefix(prefix))).toBe(mask);
    expect(prefixFromMask(parseIp(mask)!)).toBe(prefix);
  });

  it("round-trips every prefix 0-32", () => {
    for (let prefix = 0; prefix <= 32; prefix++) {
      expect(prefixFromMask(maskFromPrefix(prefix))).toBe(prefix);
    }
  });

  it("rejects a non-contiguous mask", () => {
    expect(prefixFromMask(parseIp("255.0.255.0")!)).toBeNull();
    expect(prefixFromMask(parseIp("255.255.255.191")!)).toBeNull();
  });

  it("throws SubnetMathError for an out-of-range prefix", () => {
    expect(() => maskFromPrefix(-1)).toThrow(SubnetMathError);
    expect(() => maskFromPrefix(33)).toThrow(SubnetMathError);
    expect(() => maskFromPrefix(1.5)).toThrow(SubnetMathError);
  });
});

describe("computeSubnet", () => {
  it("192.168.10.37/26 — the textbook case", () => {
    const facts = computeSubnet("192.168.10.37", 26);
    expect(formatIp(facts.network)).toBe("192.168.10.0");
    expect(formatIp(facts.broadcast)).toBe("192.168.10.63");
    expect(formatIp(facts.firstHost!)).toBe("192.168.10.1");
    expect(formatIp(facts.lastHost!)).toBe("192.168.10.62");
    expect(facts.usableHosts).toBe(62);
    expect(formatIp(facts.mask)).toBe("255.255.255.192");
    expect(facts.blockSize).toBe(64);
    expect(facts.hostBits).toBe(6);
  });

  it("10.0.0.0/8 — a large block", () => {
    const facts = computeSubnet("10.5.200.3", 8);
    expect(formatIp(facts.network)).toBe("10.0.0.0");
    expect(formatIp(facts.broadcast)).toBe("10.255.255.255");
    expect(formatIp(facts.firstHost!)).toBe("10.0.0.1");
    expect(formatIp(facts.lastHost!)).toBe("10.255.255.254");
    expect(facts.usableHosts).toBe(16777214);
  });

  it("172.16.5.10/20", () => {
    const facts = computeSubnet("172.16.5.10", 20);
    expect(formatIp(facts.network)).toBe("172.16.0.0");
    expect(formatIp(facts.broadcast)).toBe("172.16.15.255");
    expect(formatIp(facts.firstHost!)).toBe("172.16.0.1");
    expect(formatIp(facts.lastHost!)).toBe("172.16.15.254");
    expect(facts.usableHosts).toBe(4094);
  });

  it("192.168.1.100/24", () => {
    const facts = computeSubnet("192.168.1.100", 24);
    expect(formatIp(facts.network)).toBe("192.168.1.0");
    expect(formatIp(facts.broadcast)).toBe("192.168.1.255");
    expect(facts.usableHosts).toBe(254);
  });

  it("192.168.1.100/25 — first half of a split /24", () => {
    const facts = computeSubnet("192.168.1.100", 25);
    expect(formatIp(facts.network)).toBe("192.168.1.0");
    expect(formatIp(facts.broadcast)).toBe("192.168.1.127");
    expect(facts.usableHosts).toBe(126);
  });

  it("192.168.1.200/25 — second half of a split /24", () => {
    const facts = computeSubnet("192.168.1.200", 25);
    expect(formatIp(facts.network)).toBe("192.168.1.128");
    expect(formatIp(facts.broadcast)).toBe("192.168.1.255");
    expect(formatIp(facts.firstHost!)).toBe("192.168.1.129");
    expect(formatIp(facts.lastHost!)).toBe("192.168.1.254");
    expect(facts.usableHosts).toBe(126);
  });

  it.each([
    [27, "10.10.10.0", "10.10.10.31", "10.10.10.1", "10.10.10.30", 30],
    [28, "10.10.10.0", "10.10.10.15", "10.10.10.1", "10.10.10.14", 14],
    [29, "10.10.10.8", "10.10.10.15", "10.10.10.9", "10.10.10.14", 6],
    [30, "10.10.10.8", "10.10.10.11", "10.10.10.9", "10.10.10.10", 2],
  ])("10.10.10.10/%d", (prefix, network, broadcast, first, last, usable) => {
    const facts = computeSubnet("10.10.10.10", prefix);
    expect(formatIp(facts.network)).toBe(network);
    expect(formatIp(facts.broadcast)).toBe(broadcast);
    expect(formatIp(facts.firstHost!)).toBe(first);
    expect(formatIp(facts.lastHost!)).toBe(last);
    expect(facts.usableHosts).toBe(usable);
  });

  it("10.10.10.10/31 — no usable hosts under the classic formula", () => {
    const facts = computeSubnet("10.10.10.10", 31);
    expect(formatIp(facts.network)).toBe("10.10.10.10");
    expect(formatIp(facts.broadcast)).toBe("10.10.10.11");
    expect(facts.usableHosts).toBe(0);
    expect(facts.firstHost).toBeNull();
    expect(facts.lastHost).toBeNull();
  });

  it("10.10.10.10/32 — a single host route", () => {
    const facts = computeSubnet("10.10.10.10", 32);
    expect(formatIp(facts.network)).toBe("10.10.10.10");
    expect(formatIp(facts.broadcast)).toBe("10.10.10.10");
    expect(facts.usableHosts).toBe(0);
    expect(facts.firstHost).toBeNull();
    expect(facts.lastHost).toBeNull();
  });

  it("0.0.0.0/0 — the entire address space", () => {
    const facts = computeSubnet("10.1.2.3", 0);
    expect(formatIp(facts.network)).toBe("0.0.0.0");
    expect(formatIp(facts.broadcast)).toBe("255.255.255.255");
    expect(facts.usableHosts).toBe(4294967294);
  });

  it("accepts a raw uint32 in addition to a string", () => {
    const fromString = computeSubnet("192.168.10.37", 26);
    const fromInt = computeSubnet(parseIp("192.168.10.37")!, 26);
    expect(fromInt).toEqual(fromString);
  });

  it("throws SubnetMathError for an invalid IP string", () => {
    expect(() => computeSubnet("not.an.ip.address", 24)).toThrow(SubnetMathError);
  });
});

describe("vlsmFit", () => {
  it.each([
    [1, 30, 2],
    [2, 30, 2],
    [3, 29, 6],
    [6, 29, 6],
    [7, 28, 14],
    [50, 26, 62],
    [62, 26, 62],
    [63, 25, 126],
    [500, 23, 510],
    [4094, 20, 4094],
    [4095, 19, 8190],
  ])("hosts=%d -> /%d (usable %d)", (hosts, expectedPrefix, expectedUsable) => {
    const fit = vlsmFit(hosts);
    expect(fit).not.toBeNull();
    expect(fit!.prefix).toBe(expectedPrefix);
    expect(fit!.usableHosts).toBe(expectedUsable);
    // Must actually satisfy the requirement, and be the SMALLEST such block —
    // the next prefix up (one bit smaller block) must NOT fit.
    expect(fit!.usableHosts).toBeGreaterThanOrEqual(hosts);
    if (expectedPrefix < 30) {
      const oneSizeSmaller = 2 ** (32 - (expectedPrefix + 1)) - 2;
      expect(oneSizeSmaller).toBeLessThan(hosts);
    }
  });

  it.each([[0], [-1], [1.5], [NaN]])("returns null for an invalid host count (%d)", (hosts) => {
    expect(vlsmFit(hosts)).toBeNull();
  });

  it("never returns /31 or /32 — VLSM wants an actual LAN subnet", () => {
    for (const hosts of [1, 2, 3]) {
      expect(vlsmFit(hosts)!.prefix).toBeLessThanOrEqual(30);
    }
  });
});
