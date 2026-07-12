// Pure parse + validate for lesson MDX files under
// packages/content/lessons/**/*.mdx. No DB/fs access here — see
// prisma/seed.ts for the apply step. Contract: packages/content/lessons/README.md.

import { parse as parseYaml } from "yaml";
import { ID_PATTERN, type TrackLevel } from "../taxonomy/parse";

export type { TrackLevel };

export interface CheckQuestion {
  q: string;
  options: string[];
  answer: number;
  why: string;
}

export interface LessonMeta {
  slug: string;
  title: string;
  domainId: string;
  level: TrackLevel;
  minutes: number;
  sortOrder: number;
  published: boolean;
  skills: string[];
  check: CheckQuestion[];
}

export interface ParsedLesson {
  meta: LessonMeta;
  body: string;
}

/** The DB-row shape of a lesson: metadata synced by the seed, minus the
 * check questions (those live only in frontmatter, read at render time). */
export type LessonRow = Omit<LessonMeta, "check">;

export function toLessonRow(meta: LessonMeta): LessonRow {
  const { check: _check, ...row } = meta;
  return row;
}

export class LessonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LessonError";
  }
}

const LEVEL_MAP: Record<string, TrackLevel> = {
  foundations: "FOUNDATIONS",
  standard: "STANDARD",
  advanced: "ADVANCED",
};

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function splitFrontmatter(text: string, where: string): { data: unknown; body: string } {
  const match = FRONTMATTER_PATTERN.exec(text);
  if (!match) {
    throw new LessonError(`${where}: missing YAML frontmatter (--- fenced block)`);
  }
  const frontmatterText = match[1]!;
  const body = match[2]!;
  const data = parseYaml(frontmatterText);
  return { data, body };
}

interface RawCheckQuestion {
  q?: unknown;
  options?: unknown;
  answer?: unknown;
  why?: unknown;
}

interface RawFrontmatter {
  slug?: unknown;
  title?: unknown;
  domainId?: unknown;
  level?: unknown;
  minutes?: unknown;
  sortOrder?: unknown;
  published?: unknown;
  skills?: unknown;
  check?: unknown;
}

function assertNonEmptyString(value: unknown, field: string, where: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LessonError(`${where}: missing or non-string "${field}"`);
  }
  return value;
}

function parseCheck(raw: unknown, where: string): CheckQuestion[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new LessonError(`${where}: "check" must be a non-empty array`);
  }
  return raw.map((rawQuestion, index) => {
    const question = rawQuestion as RawCheckQuestion;
    const qWhere = `${where}.check[${index}]`;
    const q = assertNonEmptyString(question.q, "q", qWhere);
    const why = assertNonEmptyString(question.why, "why", qWhere);
    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new LessonError(`${qWhere}: "options" must have at least 2 entries`);
    }
    const options = question.options.map((option, optionIndex) =>
      assertNonEmptyString(option, `options[${optionIndex}]`, qWhere),
    );
    if (
      typeof question.answer !== "number" ||
      !Number.isInteger(question.answer) ||
      question.answer < 0 ||
      question.answer >= options.length
    ) {
      throw new LessonError(
        `${qWhere}: "answer" must be an integer index into "options" (0-${options.length - 1})`,
      );
    }
    return { q, options, answer: question.answer, why };
  });
}

/**
 * Parses and fully validates a single lesson MDX file's frontmatter + body.
 * Throws LessonError with a precise message on any structural problem.
 * Does not check skill-id references against the taxonomy — see
 * validateSkillRefs, which needs the set of known taxonomy nodes.
 */
export function parseLesson(text: string, where: string): ParsedLesson {
  const { data, body } = splitFrontmatter(text, where);
  if (data === null || typeof data !== "object") {
    throw new LessonError(`${where}: frontmatter is empty or not a YAML mapping`);
  }
  const raw = data as RawFrontmatter;

  const slug = assertNonEmptyString(raw.slug, "slug", where);
  const title = assertNonEmptyString(raw.title, "title", where);
  const domainId = assertNonEmptyString(raw.domainId, "domainId", where);
  if (!ID_PATTERN.test(domainId)) {
    throw new LessonError(`${where}: "domainId" "${domainId}" is not a well-formed dotted lowercase id`);
  }

  const level = typeof raw.level === "string" ? LEVEL_MAP[raw.level] : undefined;
  if (level === undefined) {
    throw new LessonError(`${where}: "level" must be one of foundations, standard, advanced`);
  }

  if (typeof raw.minutes !== "number" || !Number.isInteger(raw.minutes) || raw.minutes <= 0) {
    throw new LessonError(`${where}: "minutes" must be a positive integer`);
  }

  if (typeof raw.sortOrder !== "number" || !Number.isInteger(raw.sortOrder)) {
    throw new LessonError(`${where}: "sortOrder" must be an integer`);
  }

  if (typeof raw.published !== "boolean") {
    throw new LessonError(`${where}: "published" must be a boolean`);
  }

  if (!Array.isArray(raw.skills) || raw.skills.length === 0) {
    throw new LessonError(`${where}: "skills" must be a non-empty array`);
  }
  const skills = raw.skills.map((skillId, index) => {
    const id = assertNonEmptyString(skillId, `skills[${index}]`, where);
    if (!ID_PATTERN.test(id)) {
      throw new LessonError(`${where}: skills[${index}] "${id}" is not a well-formed dotted lowercase id`);
    }
    return id;
  });

  const check = parseCheck(raw.check, where);

  return {
    meta: { slug, title, domainId, level, minutes: raw.minutes, sortOrder: raw.sortOrder, published: raw.published, skills, check },
    body: body.trim(),
  };
}

/** Parses a batch of lesson files and enforces a globally-unique slug. */
export function parseLessons(files: { path: string; text: string }[]): ParsedLesson[] {
  const lessons = files.map(({ path, text }) => parseLesson(text, path));
  const seenSlugs = new Map<string, string>();
  lessons.forEach((lesson, index) => {
    const priorPath = seenSlugs.get(lesson.meta.slug);
    if (priorPath) {
      throw new LessonError(`duplicate lesson slug "${lesson.meta.slug}" (also used by ${priorPath})`);
    }
    seenSlugs.set(lesson.meta.slug, files[index]!.path);
  });
  return lessons;
}

export interface KnownNode {
  id: string;
  kind: "DOMAIN" | "CATEGORY" | "SKILL";
}

/**
 * Validates every domainId/skills[] reference against the taxonomy spine.
 * Fails loudly (throws LessonError) if any id is unknown or the wrong kind —
 * the spine must hold. Pure: takes the known-node set as a parameter.
 */
export function validateSkillRefs(lessons: ParsedLesson[], knownNodes: KnownNode[]): void {
  const byId = new Map(knownNodes.map((node) => [node.id, node]));
  for (const { meta } of lessons) {
    const domain = byId.get(meta.domainId);
    if (!domain) {
      throw new LessonError(`lesson "${meta.slug}": unknown domainId "${meta.domainId}"`);
    }
    if (domain.kind !== "DOMAIN") {
      throw new LessonError(`lesson "${meta.slug}": domainId "${meta.domainId}" is not a taxonomy domain`);
    }
    for (const skillId of meta.skills) {
      const skill = byId.get(skillId);
      if (!skill) {
        throw new LessonError(`lesson "${meta.slug}": unknown skill node id "${skillId}"`);
      }
      if (skill.kind !== "SKILL") {
        throw new LessonError(`lesson "${meta.slug}": "${skillId}" is not a taxonomy skill (leaf) node`);
      }
    }
  }
}
