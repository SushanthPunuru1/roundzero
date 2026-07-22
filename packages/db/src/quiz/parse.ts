// Pure parse + validate for question-bank quiz content
// (packages/content/<quiz>/*.yaml). Generic across quizzes — a "quiz" here
// is just a `quizId` string (e.g. "networking") with question `category`
// strings scoped inside it. This is the DECISIONS 031 forensics pattern
// generalized so a second quiz (and any future one) doesn't need its own
// parse/reconcile pair, its own answer-key discipline, or its own
// FormatDiff-aware grading — only its own content directory and, in
// apps/web, its own route + category catalog for display.
//
// Forensics is NOT ported onto this — it shipped first, on its own
// dedicated ForensicsQuestion/ForensicsProgress tables and its own
// forensics/parse.ts, and both still work; only the domain-agnostic grading
// (quiz/grade.ts) is actually shared with it. See DECISIONS for the "why."
//
// No DB access here — see prisma/seed.ts for the apply step. DECISIONS 006/007.

import { parse as parseYaml } from "yaml";
import { ID_PATTERN } from "../taxonomy/parse";
import type { KnownNode } from "../lessons/parse";

export interface DesiredQuizQuestion {
  id: string;
  quizId: string;
  category: string;
  skillNodeId: string;
  prompt: string;
  given: string | null;
  answer: string;
  accepts: string[];
  caseSensitive: boolean;
  stripTrailingSlash: boolean;
  technique: string | null;
  why: string;
  sortOrder: number;
}

/** The DB-row shape of a question: the client-safe fields only. The answer
 * key (`answer`/`accepts`/`caseSensitive`/`stripTrailingSlash`/`technique`/
 * `why`) is never synced to the DB — grading re-reads the YAML server-side,
 * the same discipline lesson MDX checks and forensics questions use. */
export type QuizQuestionRow = Pick<
  DesiredQuizQuestion,
  "id" | "quizId" | "category" | "skillNodeId" | "prompt" | "given" | "sortOrder"
>;

export function toQuizRow(question: DesiredQuizQuestion): QuizQuestionRow {
  const { id, quizId, category, skillNodeId, prompt, given, sortOrder } = question;
  return { id, quizId, category, skillNodeId, prompt, given, sortOrder };
}

export class QuizError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizError";
  }
}

const CATEGORY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface RawQuestion {
  id?: unknown;
  quizId?: unknown;
  category?: unknown;
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
  quizId?: unknown;
  questions?: unknown;
}

function assertId(id: unknown, field: string, where: string): string {
  if (typeof id !== "string" || id.length === 0) {
    throw new QuizError(`${where}: missing or non-string "${field}"`);
  }
  if (!ID_PATTERN.test(id)) {
    throw new QuizError(`${where}: "${field}" "${id}" is not a well-formed dotted lowercase id`);
  }
  return id;
}

function assertNonEmptyString(value: unknown, field: string, where: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new QuizError(`${where}: missing or non-string "${field}"`);
  }
  return value;
}

function assertOptionalString(value: unknown, field: string, where: string): string | null {
  if (value === undefined) return null;
  return assertNonEmptyString(value, field, where);
}

function assertBoolean(value: unknown, field: string, where: string): boolean {
  if (typeof value !== "boolean") {
    throw new QuizError(`${where}: "${field}" must be a boolean`);
  }
  return value;
}

function parseAccepts(raw: unknown, where: string): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new QuizError(`${where}: "accepts" must be an array of strings`);
  }
  return raw.map((entry, index) => assertNonEmptyString(entry, `accepts[${index}]`, where));
}

function parseQuestion(
  raw: RawQuestion,
  quizId: string,
  index: number,
  where: string,
): DesiredQuizQuestion {
  const questionWhere = `${where}.questions[${index}]`;
  const id = assertId(raw.id, "id", questionWhere);

  if (typeof raw.category !== "string" || !CATEGORY_PATTERN.test(raw.category)) {
    throw new QuizError(`${questionWhere} ("${id}"): "category" must be a kebab-case string`);
  }
  const category = raw.category;

  const skillNodeId = assertId(raw.skillNodeId, "skillNodeId", `${questionWhere} ("${id}")`);
  const prompt = assertNonEmptyString(raw.prompt, "prompt", `${questionWhere} ("${id}")`);
  const given = assertOptionalString(raw.given, "given", `${questionWhere} ("${id}")`);
  const answer = assertNonEmptyString(raw.answer, "answer", `${questionWhere} ("${id}")`);
  const accepts = parseAccepts(raw.accepts, `${questionWhere} ("${id}")`);
  const caseSensitive =
    raw.case_sensitive === undefined
      ? false
      : assertBoolean(raw.case_sensitive, "case_sensitive", `${questionWhere} ("${id}")`);
  const stripTrailingSlash =
    raw.strip_trailing_slash === undefined
      ? false
      : assertBoolean(raw.strip_trailing_slash, "strip_trailing_slash", `${questionWhere} ("${id}")`);
  const technique = assertOptionalString(raw.technique, "technique", `${questionWhere} ("${id}")`);
  const why = assertNonEmptyString(raw.why, "why", `${questionWhere} ("${id}")`);

  return {
    id,
    quizId,
    category,
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
 * Parses and fully validates a single quiz-bank YAML file. Throws QuizError
 * with a precise message on any structural problem — never returns partial
 * data. Does not check skillNodeId against the taxonomy — see
 * validateQuizRefs.
 */
export function parseQuizFile(text: string, where: string): DesiredQuizQuestion[] {
  const data = parseYaml(text) as RawFile | null;
  if (data === null || typeof data !== "object") {
    throw new QuizError(`${where}: empty or not a YAML mapping`);
  }
  const quizId = assertId(data.quizId, "quizId", where);
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw new QuizError(`${where}: missing top-level "questions" array`);
  }

  return data.questions.map((rawQuestion, index) =>
    parseQuestion(rawQuestion as RawQuestion, quizId, index, where),
  );
}

/** Parses a batch of quiz files and enforces a globally-unique question id. */
export function parseQuiz(files: { path: string; text: string }[]): DesiredQuizQuestion[] {
  const questions = files.flatMap(({ path, text }) => parseQuizFile(text, path));
  const seenIds = new Set<string>();
  for (const question of questions) {
    if (seenIds.has(question.id)) {
      throw new QuizError(`duplicate quiz question id "${question.id}"`);
    }
    seenIds.add(question.id);
  }
  return questions;
}

/**
 * Validates every skillNodeId reference against the taxonomy spine. Fails
 * loudly (throws QuizError) if any id is unknown or not a leaf skill node —
 * the spine must hold for quiz questions too. Pure: takes the known-node set
 * as a parameter.
 */
export function validateQuizRefs(questions: DesiredQuizQuestion[], knownNodes: KnownNode[]): void {
  const byId = new Map(knownNodes.map((node) => [node.id, node]));
  for (const question of questions) {
    const skill = byId.get(question.skillNodeId);
    if (!skill) {
      throw new QuizError(`quiz question "${question.id}": unknown skill node id "${question.skillNodeId}"`);
    }
    if (skill.kind !== "SKILL") {
      throw new QuizError(
        `quiz question "${question.id}": "${question.skillNodeId}" is not a taxonomy skill (leaf) node`,
      );
    }
  }
}
