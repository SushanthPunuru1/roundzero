// Pure parse + validate for packages/content/placement/*.yaml — the
// placement-only multiple-choice question bank (ONBOARDING_PATH_SPEC.md
// Part A). One file per domain. No DB access here — see prisma/seed.ts for
// the validation-only sync step (there is no PlacementQuestion table; see
// ./ladder.ts's header comment for why). Contract:
// packages/content/placement/README.md.

import { parse as parseYaml } from "yaml";
import { ID_PATTERN } from "../taxonomy/parse";
import type { KnownNode } from "../lessons/parse";

export type PlacementDomain = "foundations" | "linux" | "windows" | "networking";
export type PlacementTier = "foundations" | "standard" | "advanced";

/** Block order: the check asks all of one domain's questions before moving
 * to the next (ladder.ts), foundations first. */
export const PLACEMENT_DOMAINS: PlacementDomain[] = ["foundations", "linux", "windows", "networking"];
export const PLACEMENT_TIERS: PlacementTier[] = ["foundations", "standard", "advanced"];

export interface DesiredPlacementQuestion {
  id: string;
  domain: PlacementDomain;
  tier: PlacementTier;
  skillNodeId: string;
  prompt: string;
  options: string[];
  answer: number;
  why: string;
  sortOrder: number;
}

/** The client-safe shape: never ships the answer index or `why` until the
 * question has actually been graded server-side. Same discipline as lesson
 * checks (DECISIONS 020) and forensics/quiz (031/033). "I'm not sure yet" is
 * NOT one of these `options` — the UI appends it itself (see ladder.ts's
 * `NOT_SURE`), so it can never collide with an authored `answer` index and
 * every question gets it for free without being authored per-question. */
export type PlacementQuestionPublic = Pick<
  DesiredPlacementQuestion,
  "id" | "domain" | "tier" | "prompt" | "options"
>;

export function toPublicQuestion(question: DesiredPlacementQuestion): PlacementQuestionPublic {
  const { id, domain, tier, prompt, options } = question;
  return { id, domain, tier, prompt, options };
}

export class PlacementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlacementError";
  }
}

const DOMAIN_VALUES = new Set<string>(PLACEMENT_DOMAINS);
const TIER_VALUES = new Set<string>(PLACEMENT_TIERS);

interface RawQuestion {
  id?: unknown;
  tier?: unknown;
  skillNodeId?: unknown;
  prompt?: unknown;
  options?: unknown;
  answer?: unknown;
  why?: unknown;
}

interface RawFile {
  version?: unknown;
  domain?: unknown;
  questions?: unknown;
}

function assertId(id: unknown, field: string, where: string): string {
  if (typeof id !== "string" || id.length === 0) {
    throw new PlacementError(`${where}: missing or non-string "${field}"`);
  }
  if (!ID_PATTERN.test(id)) {
    throw new PlacementError(`${where}: "${field}" "${id}" is not a well-formed dotted lowercase id`);
  }
  return id;
}

function assertNonEmptyString(value: unknown, field: string, where: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PlacementError(`${where}: missing or non-string "${field}"`);
  }
  return value;
}

function parseQuestion(
  raw: RawQuestion,
  domain: PlacementDomain,
  index: number,
  where: string,
): DesiredPlacementQuestion {
  const questionWhere = `${where}.questions[${index}]`;
  const id = assertId(raw.id, "id", questionWhere);

  if (typeof raw.tier !== "string" || !TIER_VALUES.has(raw.tier)) {
    throw new PlacementError(
      `${questionWhere} ("${id}"): "tier" must be one of ${[...TIER_VALUES].join(", ")}`,
    );
  }
  const tier = raw.tier as PlacementTier;

  const skillNodeId = assertId(raw.skillNodeId, "skillNodeId", `${questionWhere} ("${id}")`);
  const prompt = assertNonEmptyString(raw.prompt, "prompt", `${questionWhere} ("${id}")`);

  if (!Array.isArray(raw.options) || raw.options.length < 2) {
    throw new PlacementError(`${questionWhere} ("${id}"): "options" must have at least 2 entries`);
  }
  const options = raw.options.map((option, optionIndex) =>
    assertNonEmptyString(option, `options[${optionIndex}]`, `${questionWhere} ("${id}")`),
  );

  if (
    typeof raw.answer !== "number" ||
    !Number.isInteger(raw.answer) ||
    raw.answer < 0 ||
    raw.answer >= options.length
  ) {
    throw new PlacementError(
      `${questionWhere} ("${id}"): "answer" must be an integer index into "options" (0-${options.length - 1})`,
    );
  }

  const why = assertNonEmptyString(raw.why, "why", `${questionWhere} ("${id}")`);

  return { id, domain, tier, skillNodeId, prompt, options, answer: raw.answer, why, sortOrder: index };
}

/**
 * Parses and fully validates a single placement-bank YAML file. Throws
 * PlacementError with a precise message on any structural problem — never
 * returns partial data. Does not check skillNodeId against the taxonomy —
 * see validatePlacementRefs.
 */
export function parsePlacementFile(text: string, where: string): DesiredPlacementQuestion[] {
  const data = parseYaml(text) as RawFile | null;
  if (data === null || typeof data !== "object") {
    throw new PlacementError(`${where}: empty or not a YAML mapping`);
  }
  if (typeof data.domain !== "string" || !DOMAIN_VALUES.has(data.domain)) {
    throw new PlacementError(`${where}: "domain" must be one of ${[...DOMAIN_VALUES].join(", ")}`);
  }
  const domain = data.domain as PlacementDomain;
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw new PlacementError(`${where}: missing top-level "questions" array`);
  }

  return data.questions.map((rawQuestion, index) =>
    parseQuestion(rawQuestion as RawQuestion, domain, index, where),
  );
}

/** Parses a batch of placement files and enforces a globally-unique question id. */
export function parsePlacement(files: { path: string; text: string }[]): DesiredPlacementQuestion[] {
  const questions = files.flatMap(({ path, text }) => parsePlacementFile(text, path));
  const seenIds = new Set<string>();
  for (const question of questions) {
    if (seenIds.has(question.id)) {
      throw new PlacementError(`duplicate placement question id "${question.id}"`);
    }
    seenIds.add(question.id);
  }
  return questions;
}

/**
 * Validates every skillNodeId reference against the taxonomy spine. Fails
 * loudly (throws PlacementError) if any id is unknown or not a leaf skill
 * node — the spine must hold for placement questions too. Pure: takes the
 * known-node set as a parameter.
 */
export function validatePlacementRefs(questions: DesiredPlacementQuestion[], knownNodes: KnownNode[]): void {
  const byId = new Map(knownNodes.map((node) => [node.id, node]));
  for (const question of questions) {
    const skill = byId.get(question.skillNodeId);
    if (!skill) {
      throw new PlacementError(
        `placement question "${question.id}": unknown skill node id "${question.skillNodeId}"`,
      );
    }
    if (skill.kind !== "SKILL") {
      throw new PlacementError(
        `placement question "${question.id}": "${question.skillNodeId}" is not a taxonomy skill (leaf) node`,
      );
    }
  }
}

/**
 * The ladder (see ./ladder.ts) can, in a single domain's 3-question run,
 * need at most 3 foundations-tier, 1 standard-tier, and 1 advanced-tier
 * question (a correct-then-wrong or all-wrong walk never revisits standard/
 * advanced twice — each step moves exactly one tier). Fails loudly at seed
 * time if any domain is under that floor, rather than letting the ladder's
 * defensive fallback silently paper over thin content at runtime.
 */
export function validatePlacementCoverage(questions: DesiredPlacementQuestion[]): void {
  for (const domain of PLACEMENT_DOMAINS) {
    const inDomain = questions.filter((question) => question.domain === domain);
    const counts = {
      foundations: inDomain.filter((question) => question.tier === "foundations").length,
      standard: inDomain.filter((question) => question.tier === "standard").length,
      advanced: inDomain.filter((question) => question.tier === "advanced").length,
    };
    if (counts.foundations < 3) {
      throw new PlacementError(
        `placement domain "${domain}": needs at least 3 foundations-tier questions, has ${counts.foundations}`,
      );
    }
    if (counts.standard < 1) {
      throw new PlacementError(
        `placement domain "${domain}": needs at least 1 standard-tier question, has ${counts.standard}`,
      );
    }
    if (counts.advanced < 1) {
      throw new PlacementError(
        `placement domain "${domain}": needs at least 1 advanced-tier question, has ${counts.advanced}`,
      );
    }
  }
}
