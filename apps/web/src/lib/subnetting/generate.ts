// Seedable, deterministic problem generator. Pure — no DB, no framework
// imports. Same seed always produces the same round, which is what makes
// this testable (generate.test.ts) and lets recordQuickRound (actions.ts)
// re-derive and re-grade a submitted round server-side from just its seed,
// the same anti-cheat discipline the quiz/forensics actions use.

import { computeSubnet, formatIp, parseIp, vlsmFit } from "./math";

export type ProblemType = "cidr-breakdown" | "mask-breakdown" | "vlsm-fit" | "which-subnet";

export const PROBLEM_TYPES: ProblemType[] = [
  "cidr-breakdown",
  "mask-breakdown",
  "vlsm-fit",
  "which-subnet",
];

export interface Problem {
  type: ProblemType;
  ip: string; // dotted-decimal — the "given" host/base address
  prefix: number; // the prefix the problem is actually built on (the vlsm-fit ANSWER's prefix — never shown to the student)
  mask: string; // dotted-decimal, redundant with prefix but convenient to display
  requiredHosts?: number; // vlsm-fit only
  basePrefix?: number; // vlsm-fit only — the "given" block's own prefix, purely presentational
}

/** mulberry32 — a tiny, dependency-free seedable PRNG. Deterministic: the
 * same seed always produces the same sequence. Not cryptographic; that's
 * fine, this only needs to be reproducible for tests, not unpredictable. */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[randomInt(rng, 0, items.length - 1)]!;
}

// Private address blocks (RFC 1918) — realistic for classroom problems,
// never a real public route a student might confuse for something live.
// Each entry picks its own valid second-octet range: all of 10.0.0.0/8,
// only 172.16-172.31 (the actual 172.16.0.0/12 block), only 192.168.x.x.
const PRIVATE_BLOCKS: readonly ((rng: () => number) => [number, number])[] = [
  (rng) => [10, randomInt(rng, 0, 255)],
  (rng) => [172, randomInt(rng, 16, 31)],
  () => [192, 168],
];

/** A random host address whose first two octets come from a private block,
 * biased toward /16-/30 prefixes so breakdown/which-subnet problems always
 * have at least one usable host (firstHost/lastHost never null) — /31 and
 * /32 are real edge cases, but they're covered by math.test.ts, not asked
 * as generated UI problems. */
function randomIpAndPrefix(rng: () => number): { ip: string; prefix: number } {
  const [a, b] = pick(rng, PRIVATE_BLOCKS)(rng);
  const c = randomInt(rng, 0, 255);
  const d = randomInt(rng, 1, 254);
  const prefix = randomInt(rng, 16, 30);
  return { ip: `${a}.${b}.${c}.${d}`, prefix };
}

function generateCidrBreakdown(rng: () => number): Problem {
  const { ip, prefix } = randomIpAndPrefix(rng);
  const mask = formatIp(computeSubnet(ip, prefix).mask);
  return { type: "cidr-breakdown", ip, prefix, mask };
}

function generateMaskBreakdown(rng: () => number): Problem {
  const { ip, prefix } = randomIpAndPrefix(rng);
  const mask = formatIp(computeSubnet(ip, prefix).mask);
  return { type: "mask-breakdown", ip, prefix, mask };
}

function generateWhichSubnet(rng: () => number): Problem {
  const { ip, prefix } = randomIpAndPrefix(rng);
  const mask = formatIp(computeSubnet(ip, prefix).mask);
  return { type: "which-subnet", ip, prefix, mask };
}

// Host-count pool wide enough to land on every reasonable subnet size
// (/8-/30), skewed toward the small/medium counts a VLSM problem usually
// asks for.
function generateVlsmFit(rng: () => number): Problem {
  const [a, b] = pick(rng, PRIVATE_BLOCKS)(rng);
  const ip = `${a}.${b}.0.0`;
  const requiredHosts = pick(rng, [
    randomInt(rng, 2, 14),
    randomInt(rng, 15, 62),
    randomInt(rng, 63, 254),
    randomInt(rng, 255, 1022),
    randomInt(rng, 1023, 4094),
  ]);
  const fit = vlsmFit(requiredHosts);
  // vlsmFit only fails for non-positive/huge inputs, neither of which this
  // pool can produce — the throw exists to fail loudly if that ever changes.
  if (!fit) throw new Error(`vlsmFit produced no result for requiredHosts=${requiredHosts}`);
  return {
    type: "vlsm-fit",
    ip,
    prefix: fit.prefix,
    mask: formatIp(fit.mask),
    requiredHosts,
    basePrefix: 16, // ip is always "a.b.0.0" here, a clean /16 boundary — cosmetic only, never graded
  };
}

export function generateProblem(rng: () => number, type?: ProblemType): Problem {
  const chosen = type ?? pick(rng, PROBLEM_TYPES);
  switch (chosen) {
    case "cidr-breakdown":
      return generateCidrBreakdown(rng);
    case "mask-breakdown":
      return generateMaskBreakdown(rng);
    case "vlsm-fit":
      return generateVlsmFit(rng);
    case "which-subnet":
      return generateWhichSubnet(rng);
  }
}

/** Deterministic: the same seed always produces the same round. `types`
 * restricts which problem types are drawn (used by the endless-mode filter);
 * omit for the full mix. */
export function generateRound(seed: number, count: number, types?: ProblemType[]): Problem[] {
  const rng = makeRng(seed);
  const pool = types && types.length > 0 ? types : PROBLEM_TYPES;
  return Array.from({ length: count }, () => generateProblem(rng, pick(rng, pool)));
}

// Re-exported so callers building the worked-solution view don't need a
// second import from "./math" just for parseIp.
export { parseIp };
