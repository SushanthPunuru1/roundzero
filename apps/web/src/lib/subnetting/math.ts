// Pure IPv4 subnet math. No dependencies, no DB, no framework imports —
// bundled directly into the client-side subnetting trainer (unlike every
// other content type in this repo, there is no secret answer key to protect
// here: subnet math is derivable by anyone, so it never needs to stay
// server-side). Every function is deterministic and exhaustively covered in
// math.test.ts — that file is the correctness spec for the whole tool.

export class SubnetMathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubnetMathError";
  }
}

/** Parses a strict dotted-quad IPv4 string ("192.168.10.5") to a uint32.
 * Returns null (never throws) on anything malformed — each octet must be a
 * plain base-10 integer 0-255 with no extra characters; surrounding
 * whitespace is trimmed, but a leading zero like "010" is still accepted as
 * decimal 10 (never octal), matching how students naturally type addresses. */
export function parseIp(input: string): number | null {
  const parts = input.trim().split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

export function formatIp(value: number): string {
  const v = value >>> 0;
  return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join(".");
}

/** Dotted-octet binary, e.g. "11000000.10101000.00001010.00100101". */
export function ipToBinary(value: number): string {
  const v = value >>> 0;
  return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]
    .map((octet) => octet.toString(2).padStart(8, "0"))
    .join(".");
}

export function maskFromPrefix(prefix: number): number {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new SubnetMathError(`prefix must be an integer 0-32, got ${prefix}`);
  }
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/** The prefix length for a contiguous subnet mask, or null if the mask
 * isn't a valid contiguous run of 1-bits followed by 0-bits (e.g.
 * 255.0.255.0 is rejected, not "corrected"). */
export function prefixFromMask(mask: number): number | null {
  const m = mask >>> 0;
  let ones = 0;
  let seenZero = false;
  for (let bit = 31; bit >= 0; bit--) {
    if ((m >>> bit) & 1) {
      if (seenZero) return null;
      ones++;
    } else {
      seenZero = true;
    }
  }
  return ones;
}

export interface SubnetFacts {
  prefix: number;
  mask: number;
  wildcard: number;
  network: number;
  broadcast: number;
  firstHost: number | null;
  lastHost: number | null;
  usableHosts: number;
  totalAddresses: number;
  blockSize: number;
  hostBits: number;
}

/**
 * The core computation: everything derivable from an IP + prefix length.
 *
 * Host-count convention (documented here because it's a real teaching
 * choice, not an oversight): usableHosts = max(2^hostBits - 2, 0), so
 * /30 -> 2, /31 -> 0, /32 -> 0 — the classic subnetting-class formula every
 * CyberPatriot student is taught. firstHost/lastHost are null whenever
 * usableHosts is 0. A /31 (RFC 3021 point-to-point, both addresses usable in
 * practice) and a /32 (single-host route) are real networking edge cases —
 * they're called out in the worked-solution prose rather than folded into
 * this formula, so the trainer stays consistent with the rule it teaches.
 */
export function computeSubnet(ipInput: string | number, prefix: number): SubnetFacts {
  const ip = typeof ipInput === "string" ? parseIp(ipInput) : ipInput;
  if (ip === null || ip === undefined) {
    throw new SubnetMathError(`invalid IPv4 address: "${String(ipInput)}"`);
  }
  const mask = maskFromPrefix(prefix);
  const wildcard = ~mask >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const hostBits = 32 - prefix;
  const totalAddresses = 2 ** hostBits;
  const usableHosts = Math.max(totalAddresses - 2, 0);
  const firstHost = usableHosts > 0 ? (network + 1) >>> 0 : null;
  const lastHost = usableHosts > 0 ? (broadcast - 1) >>> 0 : null;

  return {
    prefix,
    mask,
    wildcard,
    network,
    broadcast,
    firstHost,
    lastHost,
    usableHosts,
    totalAddresses,
    blockSize: totalAddresses,
    hostBits,
  };
}

export interface VlsmFit {
  prefix: number;
  mask: number;
  usableHosts: number;
  totalAddresses: number;
}

/**
 * Finds the smallest subnet (largest prefix / smallest block) that can host
 * at least `hosts` usable addresses, using the same usableHosts formula as
 * computeSubnet. Deliberately searches only /30 down to /0 — VLSM problems
 * ask for an actual LAN-sized subnet, so /31 and /32 (0 usable under this
 * formula) are excluded by construction rather than by a special case.
 * Returns null for a non-positive or non-integer host requirement.
 */
export function vlsmFit(hosts: number): VlsmFit | null {
  if (!Number.isInteger(hosts) || hosts <= 0) return null;
  for (let prefix = 30; prefix >= 0; prefix--) {
    const totalAddresses = 2 ** (32 - prefix);
    const usableHosts = totalAddresses - 2;
    if (usableHosts >= hosts) {
      return { prefix, mask: maskFromPrefix(prefix), usableHosts, totalAddresses };
    }
  }
  return null;
}
