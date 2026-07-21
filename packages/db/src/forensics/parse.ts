// Pure parse + validate for packages/content/forensics/*.yaml.
// No DB access here — see prisma/seed.ts for the apply step. DECISIONS 006/007.
// Contract: packages/content/forensics/README.md.

import { parse as parseYaml } from "yaml";
import { ID_PATTERN } from "../taxonomy/parse";
import type { KnownNode } from "../lessons/parse";

export type ForensicsArchetype =
  | "DECODING"
  | "FILE_HUNTING"
  | "HASHING"
  | "LOGIN_HISTORY"
  | "ANSWER_FORMAT"
  | "STEGO"
  | "PORTS"
  | "ACCOUNTS";

export interface DesiredForensicsQuestion {
  id: string;
  archetype: ForensicsArchetype;
  skillNodeId: string;
  prompt: string;
  given: string;
  answer: string;
  accepts: string[];
  caseSensitive: boolean;
  stripTrailingSlash: boolean;
  technique: string;
  why: string;
  sortOrder: number;
}

/** The DB-row shape of a question: the client-safe fields only. The answer
 * key (`answer`/`accepts`/`caseSensitive`/`stripTrailingSlash`/`technique`/
 * `why`) is never synced to the DB — grading re-reads the YAML server-side,
 * the same discipline lesson MDX checks use (DECISIONS 020). */
export type ForensicsQuestionRow = Pick<
  DesiredForensicsQuestion,
  "id" | "archetype" | "skillNodeId" | "prompt" | "given" | "sortOrder"
>;

export function toForensicsRow(question: DesiredForensicsQuestion): ForensicsQuestionRow {
  const { id, archetype, skillNodeId, prompt, given, sortOrder } = question;
  return { id, archetype, skillNodeId, prompt, given, sortOrder };
}

export class ForensicsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForensicsError";
  }
}

export interface ForensicsArchetypeInfo {
  key: string; // kebab-case — used in content YAML and the /app/forensics/[archetype] route
  value: ForensicsArchetype;
  label: string;
}

/** The 8 known archetypes, ordered for the index page. Single source of
 * truth for the kebab-case (content/URL) <-> enum (DB) mapping. */
export const FORENSICS_ARCHETYPES: ForensicsArchetypeInfo[] = [
  { key: "decoding", value: "DECODING", label: "Decoding" },
  { key: "file-hunting", value: "FILE_HUNTING", label: "File hunting" },
  { key: "hashing", value: "HASHING", label: "Hashing" },
  { key: "login-history", value: "LOGIN_HISTORY", label: "Login history" },
  { key: "answer-format", value: "ANSWER_FORMAT", label: "Answer format discipline" },
  { key: "stego", value: "STEGO", label: "Steganography" },
  { key: "ports", value: "PORTS", label: "Listening ports" },
  { key: "accounts", value: "ACCOUNTS", label: "Accounts & UID lookup" },
];

const ARCHETYPE_MAP: Record<string, ForensicsArchetype> = Object.fromEntries(
  FORENSICS_ARCHETYPES.map((archetype) => [archetype.key, archetype.value]),
);

interface RawQuestion {
  id?: unknown;
  archetype?: unknown;
  skillNodeId?: unknown;
  prompt?: unknown;
  given?: unknown;
  answer?: unknown;
  accepts?: unknown;
  case_sensitive?: unknown;
  strip_trailing_slash?: unknown;
  technique?: unknown;
  why?: unknown;
}

interface RawFile {
  version?: unknown;
  questions?: unknown;
}

function assertId(id: unknown, field: string, where: string): string {
  if (typeof id !== "string" || id.length === 0) {
    throw new ForensicsError(`${where}: missing or non-string "${field}"`);
  }
  if (!ID_PATTERN.test(id)) {
    throw new ForensicsError(
      `${where}: "${field}" "${id}" is not a well-formed dotted lowercase id`,
    );
  }
  return id;
}

function assertNonEmptyString(value: unknown, field: string, where: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ForensicsError(`${where}: missing or non-string "${field}"`);
  }
  return value;
}

function assertBoolean(value: unknown, field: string, where: string): boolean {
  if (typeof value !== "boolean") {
    throw new ForensicsError(`${where}: "${field}" must be a boolean`);
  }
  return value;
}

function parseAccepts(raw: unknown, where: string): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new ForensicsError(`${where}: "accepts" must be an array of strings`);
  }
  return raw.map((entry, index) => assertNonEmptyString(entry, `accepts[${index}]`, where));
}

function parseQuestion(raw: RawQuestion, index: number, where: string): DesiredForensicsQuestion {
  const questionWhere = `${where}.questions[${index}]`;
  const id = assertId(raw.id, "id", questionWhere);

  if (typeof raw.archetype !== "string" || !(raw.archetype in ARCHETYPE_MAP)) {
    throw new ForensicsError(
      `${questionWhere} ("${id}"): "archetype" must be one of ${Object.keys(ARCHETYPE_MAP).join(", ")}`,
    );
  }
  const archetype = ARCHETYPE_MAP[raw.archetype]!;

  const skillNodeId = assertId(raw.skillNodeId, "skillNodeId", `${questionWhere} ("${id}")`);
  const prompt = assertNonEmptyString(raw.prompt, "prompt", `${questionWhere} ("${id}")`);
  const given = assertNonEmptyString(raw.given, "given", `${questionWhere} ("${id}")`);
  const answer = assertNonEmptyString(raw.answer, "answer", `${questionWhere} ("${id}")`);
  const accepts = parseAccepts(raw.accepts, `${questionWhere} ("${id}")`);
  const caseSensitive = assertBoolean(raw.case_sensitive, "case_sensitive", `${questionWhere} ("${id}")`);
  const stripTrailingSlash =
    raw.strip_trailing_slash === undefined
      ? false
      : assertBoolean(raw.strip_trailing_slash, "strip_trailing_slash", `${questionWhere} ("${id}")`);
  const technique = assertNonEmptyString(raw.technique, "technique", `${questionWhere} ("${id}")`);
  const why = assertNonEmptyString(raw.why, "why", `${questionWhere} ("${id}")`);

  return {
    id,
    archetype,
    skillNodeId,
    prompt,
    given,
    answer,
    accepts,
    caseSensitive,
    stripTrailingSlash,
    technique,
    why,
    sortOrder: index,
  };
}

/**
 * Parses and fully validates a single forensics question-bank YAML file.
 * Throws ForensicsError with a precise message on any structural problem —
 * never returns partial data. Does not check skillNodeId against the
 * taxonomy — see validateForensicsRefs.
 */
export function parseForensicsFile(text: string, where: string): DesiredForensicsQuestion[] {
  const data = parseYaml(text) as RawFile | null;
  if (data === null || typeof data !== "object") {
    throw new ForensicsError(`${where}: empty or not a YAML mapping`);
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw new ForensicsError(`${where}: missing top-level "questions" array`);
  }

  return data.questions.map((rawQuestion, index) =>
    parseQuestion(rawQuestion as RawQuestion, index, where),
  );
}

/** Parses a batch of forensics files and enforces a globally-unique question id. */
export function parseForensics(files: { path: string; text: string }[]): DesiredForensicsQuestion[] {
  const questions = files.flatMap(({ path, text }) => parseForensicsFile(text, path));
  const seenIds = new Map<string, string>();
  for (const question of questions) {
    const priorPath = seenIds.get(question.id);
    if (priorPath) {
      throw new ForensicsError(`duplicate forensics question id "${question.id}"`);
    }
    seenIds.set(question.id, question.id);
  }
  return questions;
}

/**
 * Validates every skillNodeId reference against the taxonomy spine. Fails
 * loudly (throws ForensicsError) if any id is unknown or not a leaf skill
 * node — the spine must hold for forensics questions too. Pure: takes the
 * known-node set as a parameter.
 */
export function validateForensicsRefs(
  questions: DesiredForensicsQuestion[],
  knownNodes: KnownNode[],
): void {
  const byId = new Map(knownNodes.map((node) => [node.id, node]));
  for (const question of questions) {
    const skill = byId.get(question.skillNodeId);
    if (!skill) {
      throw new ForensicsError(
        `forensics question "${question.id}": unknown skill node id "${question.skillNodeId}"`,
      );
    }
    if (skill.kind !== "SKILL") {
      throw new ForensicsError(
        `forensics question "${question.id}": "${question.skillNodeId}" is not a taxonomy skill (leaf) node`,
      );
    }
  }
}
