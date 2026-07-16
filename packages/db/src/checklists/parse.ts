// Pure parse + validate for packages/content/checklists/*.yaml.
// No DB access here — see prisma/seed.ts for the apply step. DECISIONS 006/007.

import { parse as parseYaml } from "yaml";
import { ID_PATTERN } from "../taxonomy/parse";
import type { KnownNode } from "../lessons/parse";

export type OS = "WINDOWS" | "LINUX";

export interface DesiredChecklistItem {
  id: string;
  templateId: string;
  skillNodeId: string;
  sortOrder: number;
  action: string;
  why: string;
  commands: Record<string, string>;
  lessonSlug: string | null;
  caution: string | null;
}

export interface DesiredChecklistTemplate {
  id: string;
  os: OS;
  seasonId: string;
  version: number;
  title: string;
  items: DesiredChecklistItem[];
}

export class ChecklistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChecklistError";
  }
}

const OS_VALUES: OS[] = ["WINDOWS", "LINUX"];

interface RawItem {
  id?: unknown;
  skillNodeId?: unknown;
  sortOrder?: unknown;
  action?: unknown;
  why?: unknown;
  commands?: unknown;
  lessonSlug?: unknown;
  caution?: unknown;
}

interface RawTemplate {
  id?: unknown;
  os?: unknown;
  seasonId?: unknown;
  version?: unknown;
  title?: unknown;
  items?: unknown;
}

function assertId(id: unknown, field: string, where: string): string {
  if (typeof id !== "string" || id.length === 0) {
    throw new ChecklistError(`${where}: missing or non-string "${field}"`);
  }
  if (!ID_PATTERN.test(id)) {
    throw new ChecklistError(
      `${where}: "${field}" "${id}" is not a well-formed dotted lowercase id`,
    );
  }
  return id;
}

function assertNonEmptyString(value: unknown, field: string, where: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ChecklistError(`${where}: missing or non-string "${field}"`);
  }
  return value;
}

function parseCommands(raw: unknown, where: string): Record<string, string> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ChecklistError(`${where}: "commands" must be a mapping`);
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0) {
    throw new ChecklistError(`${where}: "commands" must have at least one entry`);
  }
  const commands: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ChecklistError(`${where}: commands["${key}"] must be a non-empty string`);
    }
    commands[key] = value;
  }
  return commands;
}

function parseItem(raw: RawItem, templateId: string, where: string): DesiredChecklistItem {
  const id = assertId(raw.id, "id", where);
  const skillNodeId = assertId(raw.skillNodeId, "skillNodeId", where);

  if (typeof raw.sortOrder !== "number" || !Number.isInteger(raw.sortOrder)) {
    throw new ChecklistError(`${where}: "sortOrder" must be an integer`);
  }

  const action = assertNonEmptyString(raw.action, "action", where);
  const why = assertNonEmptyString(raw.why, "why", where);
  const commands = parseCommands(raw.commands, where);

  let lessonSlug: string | null = null;
  if (raw.lessonSlug !== undefined) {
    lessonSlug = assertId(raw.lessonSlug, "lessonSlug", where);
  }

  let caution: string | null = null;
  if (raw.caution !== undefined) {
    caution = assertNonEmptyString(raw.caution, "caution", where);
  }

  return {
    id,
    templateId,
    skillNodeId,
    sortOrder: raw.sortOrder,
    action,
    why,
    commands,
    lessonSlug,
    caution,
  };
}

/**
 * Parses and fully validates a single checklist template YAML file. Throws
 * ChecklistError with a precise message on any structural problem — never
 * returns partial data. Does not check skillNodeId/lessonSlug/seasonId
 * against known sets — see validateChecklistRefs.
 */
export function parseChecklist(text: string, where: string): DesiredChecklistTemplate {
  const data = parseYaml(text) as RawTemplate | null;
  if (data === null || typeof data !== "object") {
    throw new ChecklistError(`${where}: empty or not a YAML mapping`);
  }

  const id = assertId(data.id, "id", where);

  if (typeof data.os !== "string" || !OS_VALUES.includes(data.os as OS)) {
    throw new ChecklistError(`${where}: "os" must be one of ${OS_VALUES.join(", ")}`);
  }
  const os = data.os as OS;

  const seasonId = assertId(data.seasonId, "seasonId", where);

  if (typeof data.version !== "number" || !Number.isInteger(data.version) || data.version <= 0) {
    throw new ChecklistError(`${where}: "version" must be a positive integer`);
  }

  const title = assertNonEmptyString(data.title, "title", where);

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new ChecklistError(`${where}: "items" must be a non-empty array`);
  }

  const seenItemIds = new Set<string>();
  const items = data.items.map((rawItem, index) => {
    const itemWhere = `${where}.items[${index}]`;
    const item = parseItem(rawItem as RawItem, id, itemWhere);
    if (seenItemIds.has(item.id)) {
      throw new ChecklistError(`${where}: duplicate item id "${item.id}"`);
    }
    seenItemIds.add(item.id);
    return item;
  });

  return { id, os, seasonId, version: data.version, title, items };
}

/** Parses a batch of checklist files and enforces a globally-unique template id. */
export function parseChecklists(
  files: { path: string; text: string }[],
): DesiredChecklistTemplate[] {
  const templates = files.map(({ path, text }) => parseChecklist(text, path));
  const seenIds = new Map<string, string>();
  templates.forEach((template, index) => {
    const priorPath = seenIds.get(template.id);
    if (priorPath) {
      throw new ChecklistError(
        `duplicate checklist template id "${template.id}" (also used by ${priorPath})`,
      );
    }
    seenIds.set(template.id, files[index]!.path);
  });
  return templates;
}

/**
 * Validates every skillNodeId/lessonSlug/seasonId reference against known
 * sets synced earlier in the same run. Fails loudly (throws ChecklistError)
 * on any unknown or wrong-kind reference — the spine must hold for
 * checklists too. Pure: takes the known sets as parameters.
 */
export function validateChecklistRefs(
  templates: DesiredChecklistTemplate[],
  knownNodes: KnownNode[],
  knownLessonSlugs: Set<string>,
  knownSeasonIds: Set<string>,
): void {
  const nodesById = new Map(knownNodes.map((node) => [node.id, node]));

  for (const template of templates) {
    if (!knownSeasonIds.has(template.seasonId)) {
      throw new ChecklistError(
        `checklist "${template.id}": unknown seasonId "${template.seasonId}"`,
      );
    }

    for (const item of template.items) {
      const skill = nodesById.get(item.skillNodeId);
      if (!skill) {
        throw new ChecklistError(
          `checklist "${template.id}" item "${item.id}": unknown skill node id "${item.skillNodeId}"`,
        );
      }
      if (skill.kind !== "SKILL") {
        throw new ChecklistError(
          `checklist "${template.id}" item "${item.id}": "${item.skillNodeId}" is not a taxonomy skill (leaf) node`,
        );
      }

      if (item.lessonSlug !== null && !knownLessonSlugs.has(item.lessonSlug)) {
        throw new ChecklistError(
          `checklist "${template.id}" item "${item.id}": unknown lesson slug "${item.lessonSlug}"`,
        );
      }
    }
  }
}
