// Pure parse + validate for packages/content/taxonomy/taxonomy.yaml.
// No DB access here — see prisma/seed.ts for the apply step. DECISIONS 006/007.

import { parse as parseYaml } from "yaml";

export type NodeKind = "DOMAIN" | "CATEGORY" | "SKILL";
export type TrackLevel = "FOUNDATIONS" | "STANDARD" | "ADVANCED";

export interface DesiredNode {
  id: string;
  parentId: string | null;
  title: string;
  kind: NodeKind;
  level: TrackLevel | null;
  sortOrder: number;
}

export class TaxonomyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxonomyError";
  }
}

export const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*$/;

const LEVEL_MAP: Record<string, TrackLevel> = {
  foundations: "FOUNDATIONS",
  standard: "STANDARD",
  advanced: "ADVANCED",
};

interface RawSkill {
  id?: unknown;
  title?: unknown;
  level?: unknown;
}

interface RawCategory {
  id?: unknown;
  title?: unknown;
  skills?: unknown;
}

interface RawDomain {
  id?: unknown;
  title?: unknown;
  categories?: unknown;
}

interface RawFile {
  version?: unknown;
  domains?: unknown;
}

function assertId(id: unknown, where: string): string {
  if (typeof id !== "string" || id.length === 0) {
    throw new TaxonomyError(`${where}: missing or non-string "id"`);
  }
  if (!ID_PATTERN.test(id)) {
    throw new TaxonomyError(
      `${where}: id "${id}" is not a well-formed dotted lowercase id`,
    );
  }
  return id;
}

function assertTitle(title: unknown, where: string): string {
  if (typeof title !== "string" || title.length === 0) {
    throw new TaxonomyError(`${where}: missing or non-string "title"`);
  }
  return title;
}

/**
 * Parses and fully validates taxonomy.yaml, returning a flat list of
 * DesiredNode rows (domains, categories, skills). Throws TaxonomyError with
 * a precise message on any structural problem — never returns partial data.
 */
export function parseTaxonomy(yamlText: string): DesiredNode[] {
  const raw = parseYaml(yamlText) as RawFile | null;
  if (raw === null || typeof raw !== "object") {
    throw new TaxonomyError("taxonomy.yaml: empty or not a YAML mapping");
  }
  if (typeof raw.version !== "number") {
    throw new TaxonomyError('taxonomy.yaml: missing top-level "version"');
  }
  if (!Array.isArray(raw.domains)) {
    throw new TaxonomyError('taxonomy.yaml: missing top-level "domains" array');
  }

  const nodes: DesiredNode[] = [];
  const seenIds = new Set<string>();

  const claim = (id: string, where: string): void => {
    if (seenIds.has(id)) {
      throw new TaxonomyError(`duplicate id "${id}" (${where})`);
    }
    seenIds.add(id);
  };

  raw.domains.forEach((rawDomain, domainIndex) => {
    const domain = rawDomain as RawDomain;
    const domainWhere = `domains[${domainIndex}]`;
    const domainId = assertId(domain.id, domainWhere);
    const domainTitle = assertTitle(domain.title, domainWhere);
    if ("level" in domain) {
      throw new TaxonomyError(`${domainWhere} ("${domainId}"): domains must not set "level"`);
    }
    claim(domainId, domainWhere);
    nodes.push({
      id: domainId,
      parentId: null,
      title: domainTitle,
      kind: "DOMAIN",
      level: null,
      sortOrder: domainIndex,
    });

    const categories = domain.categories;
    if (!Array.isArray(categories)) {
      throw new TaxonomyError(`${domainWhere} ("${domainId}"): missing "categories" array`);
    }

    categories.forEach((rawCategory, categoryIndex) => {
      const category = rawCategory as RawCategory;
      const categoryWhere = `${domainWhere}.categories[${categoryIndex}]`;
      const categoryId = assertId(category.id, categoryWhere);
      const categoryTitle = assertTitle(category.title, categoryWhere);
      if ("level" in category) {
        throw new TaxonomyError(
          `${categoryWhere} ("${categoryId}"): categories must not set "level"`,
        );
      }
      if (!categoryId.startsWith(`${domainId}.`)) {
        throw new TaxonomyError(
          `${categoryWhere}: category id "${categoryId}" must be prefixed with its parent domain id "${domainId}."`,
        );
      }
      claim(categoryId, categoryWhere);
      nodes.push({
        id: categoryId,
        parentId: domainId,
        title: categoryTitle,
        kind: "CATEGORY",
        level: null,
        sortOrder: categoryIndex,
      });

      const skills = category.skills;
      if (!Array.isArray(skills)) {
        throw new TaxonomyError(`${categoryWhere} ("${categoryId}"): missing "skills" array`);
      }

      skills.forEach((rawSkill, skillIndex) => {
        const skill = rawSkill as RawSkill;
        const skillWhere = `${categoryWhere}.skills[${skillIndex}]`;
        const skillId = assertId(skill.id, skillWhere);
        const skillTitle = assertTitle(skill.title, skillWhere);
        if (!skillId.startsWith(`${categoryId}.`)) {
          throw new TaxonomyError(
            `${skillWhere}: skill id "${skillId}" must be prefixed with its parent category id "${categoryId}."`,
          );
        }
        const level =
          typeof skill.level === "string" ? LEVEL_MAP[skill.level] : undefined;
        if (level === undefined) {
          throw new TaxonomyError(
            `${skillWhere} ("${skillId}"): "level" must be one of foundations, standard, advanced`,
          );
        }
        claim(skillId, skillWhere);
        nodes.push({
          id: skillId,
          parentId: categoryId,
          title: skillTitle,
          kind: "SKILL",
          level,
          sortOrder: skillIndex,
        });
      });
    });
  });

  return nodes;
}
