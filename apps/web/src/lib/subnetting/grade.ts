// Pure per-field answer checking + round accuracy. No DB/framework imports.
// Grading here compares VALUES, not raw bytes — an IP field is correct if it
// parses to the same address as the expected one (so "192.168.010.5" and
// "192.168.10.5" both count), and numeric fields tolerate whitespace/leading
// zeros. This is deliberately more forgiving than the quiz/forensics exact-
// string grading (DECISIONS 031) because there's no answer key to protect
// here (see math.ts) — the goal is testing subnetting fluency, not typing
// discipline.

import { type Problem, type ProblemType } from "./generate";
import { computeSubnet, formatIp, parseIp } from "./math";

export type AnswerField =
  | "network"
  | "broadcast"
  | "firstHost"
  | "lastHost"
  | "usableHosts"
  | "mask"
  | "cidr";

const IP_FIELDS: readonly AnswerField[] = ["network", "broadcast", "firstHost", "lastHost", "mask"];

/** The answer fields a student fills for each problem type, in display order. */
export const FIELDS_BY_TYPE: Record<ProblemType, AnswerField[]> = {
  "cidr-breakdown": ["network", "broadcast", "firstHost", "lastHost", "usableHosts", "mask"],
  "mask-breakdown": ["network", "broadcast", "firstHost", "lastHost", "usableHosts", "cidr"],
  "vlsm-fit": ["cidr", "mask", "usableHosts"],
  "which-subnet": ["network"],
};

export const FIELD_LABELS: Record<AnswerField, string> = {
  network: "Network address",
  broadcast: "Broadcast address",
  firstHost: "First usable host",
  lastHost: "Last usable host",
  usableHosts: "Usable host count",
  mask: "Subnet mask",
  cidr: "CIDR prefix",
};

/** Parses a CIDR prefix answer — accepts "26" or "/26". */
function parseCidr(input: string): number | null {
  const trimmed = input.trim().replace(/^\//, "");
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= 0 && n <= 32 ? n : null;
}

function parseHostCount(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** The expected value for one field, as the canonical display string. Null
 * fields (firstHost/lastHost on a /31 or /32) are never asked for — see
 * FIELDS_BY_TYPE, which only includes them for problems built with a
 * /16-/30 prefix (generate.ts guarantees this for generated problems). */
function expectedValue(problem: Problem, field: AnswerField): string {
  if (field === "cidr") return `/${problem.prefix}`;
  if (field === "mask") return problem.mask;

  const facts = computeSubnet(problem.ip, problem.prefix);
  switch (field) {
    case "network":
      return formatIp(facts.network);
    case "broadcast":
      return formatIp(facts.broadcast);
    case "firstHost":
      return facts.firstHost === null ? "—" : formatIp(facts.firstHost);
    case "lastHost":
      return facts.lastHost === null ? "—" : formatIp(facts.lastHost);
    case "usableHosts":
      return String(facts.usableHosts);
  }
}

function fieldsMatch(field: AnswerField, submitted: string, expected: string): boolean {
  if (IP_FIELDS.includes(field)) {
    const submittedIp = parseIp(submitted);
    const expectedIp = parseIp(expected);
    return submittedIp !== null && expectedIp !== null && submittedIp === expectedIp;
  }
  if (field === "cidr") {
    const submittedCidr = parseCidr(submitted);
    const expectedCidr = parseCidr(expected);
    return submittedCidr !== null && expectedCidr !== null && submittedCidr === expectedCidr;
  }
  // usableHosts
  const submittedCount = parseHostCount(submitted);
  const expectedCount = parseHostCount(expected);
  return submittedCount !== null && expectedCount !== null && submittedCount === expectedCount;
}

export interface GradeResult {
  fields: Record<AnswerField, boolean>;
  expected: Record<AnswerField, string>;
  correct: boolean;
}

/** Grades every answer field for one problem. A problem counts as correct
 * only when every one of its fields is correct. */
export function gradeProblem(problem: Problem, submitted: Partial<Record<AnswerField, string>>): GradeResult {
  const fieldsForType = FIELDS_BY_TYPE[problem.type];
  const fields = {} as Record<AnswerField, boolean>;
  const expected = {} as Record<AnswerField, string>;

  for (const field of fieldsForType) {
    const expectedField = expectedValue(problem, field);
    expected[field] = expectedField;
    fields[field] = fieldsMatch(field, submitted[field] ?? "", expectedField);
  }

  return { fields, expected, correct: fieldsForType.every((field) => fields[field]) };
}

export interface RoundAccuracy {
  correct: number;
  total: number;
  accuracy: number; // 0-100, rounded
}

/** Grades a full round (problems + their submitted answers, index-aligned)
 * and returns the round's overall accuracy. */
export function gradeRound(
  problems: Problem[],
  answers: Partial<Record<AnswerField, string>>[],
): RoundAccuracy {
  const total = problems.length;
  let correct = 0;
  for (let i = 0; i < total; i++) {
    const problem = problems[i]!;
    const submitted = answers[i] ?? {};
    if (gradeProblem(problem, submitted).correct) correct++;
  }
  return { correct, total, accuracy: total === 0 ? 0 : Math.round((correct / total) * 100) };
}
