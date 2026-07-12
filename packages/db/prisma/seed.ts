// Idempotent sync of packages/content (taxonomy.yaml, lesson frontmatter,
// checklists, drill cards) into the DB index tables. YAML/MDX stays the
// source of truth; this script only upserts rows to match it.
//
// Milestone 1 implements taxonomy + lesson sync. Checklist/card sync are
// later roadmap items — not built here.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { prisma } from "../src/client";
import { parseTaxonomy, type DesiredNode, type NodeKind } from "../src/taxonomy/parse";
import { reconcile, type ExistingNode } from "../src/taxonomy/reconcile";
import { parseLessons, toLessonRow, validateSkillRefs } from "../src/lessons/parse";
import { reconcileLessons, type ExistingLessonRow, type LessonRow } from "../src/lessons/reconcile";

const CONTENT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../content",
);
const TAXONOMY_PATH = path.join(CONTENT_DIR, "taxonomy/taxonomy.yaml");
const LESSONS_DIR = path.join(CONTENT_DIR, "lessons");

const KIND_ORDER: NodeKind[] = ["DOMAIN", "CATEGORY", "SKILL"];

function listMdxFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...listMdxFiles(full));
    } else if (name.endsWith(".mdx")) {
      files.push(full);
    }
  }
  return files;
}

async function syncTaxonomy(): Promise<DesiredNode[]> {
  const yamlText = readFileSync(TAXONOMY_PATH, "utf-8");
  const desired = parseTaxonomy(yamlText);

  const existingRows = await prisma.skillNode.findMany();
  const existing: ExistingNode[] = existingRows.map((row) => ({
    id: row.id,
    parentId: row.parentId,
    title: row.title,
    kind: row.kind,
    level: row.level,
    sortOrder: row.sortOrder,
    deprecated: row.deprecated,
  }));

  const plan = reconcile(desired, existing);

  await prisma.$transaction(async (tx) => {
    const byKind = (nodes: DesiredNode[], kind: NodeKind) =>
      nodes.filter((node) => node.kind === kind);

    for (const kind of KIND_ORDER) {
      for (const node of byKind(plan.toCreate, kind)) {
        await tx.skillNode.create({
          data: {
            id: node.id,
            parentId: node.parentId,
            title: node.title,
            kind: node.kind,
            level: node.level,
            sortOrder: node.sortOrder,
            deprecated: false,
          },
        });
      }
    }

    for (const node of plan.toUpdate) {
      await tx.skillNode.update({
        where: { id: node.id },
        data: {
          parentId: node.parentId,
          title: node.title,
          kind: node.kind,
          level: node.level,
          sortOrder: node.sortOrder,
          deprecated: false,
        },
      });
    }

    for (const node of plan.toDeprecate) {
      await tx.skillNode.update({
        where: { id: node.id },
        data: { deprecated: true },
      });
    }
  });

  console.log(
    `taxonomy sync — created: ${plan.toCreate.length}, updated: ${plan.toUpdate.length}, ` +
      `deprecated: ${plan.toDeprecate.length}, unchanged: ${plan.unchanged.length}`,
  );

  return desired;
}

async function syncLessons(knownTaxonomyNodes: DesiredNode[]): Promise<void> {
  const files = listMdxFiles(LESSONS_DIR).map((filePath) => ({
    path: path.relative(LESSONS_DIR, filePath),
    text: readFileSync(filePath, "utf-8"),
  }));

  const parsed = parseLessons(files);
  validateSkillRefs(parsed, knownTaxonomyNodes);

  const desired: LessonRow[] = parsed.map(({ meta }) => toLessonRow(meta));

  const existingRows = await prisma.lesson.findMany({ include: { skills: true } });
  const existing: ExistingLessonRow[] = existingRows.map((row) => ({
    slug: row.slug,
    title: row.title,
    domainId: row.domainId,
    level: row.level,
    minutes: row.minutes,
    sortOrder: row.sortOrder,
    published: row.published,
    skills: row.skills.map((link) => link.skillNodeId),
  }));
  const existingSkillsBySlug = new Map(existing.map((row) => [row.slug, row.skills]));

  const plan = reconcileLessons(desired, existing);

  await prisma.$transaction(async (tx) => {
    for (const row of plan.toCreate) {
      await tx.lesson.create({
        data: {
          slug: row.slug,
          title: row.title,
          domainId: row.domainId,
          level: row.level,
          minutes: row.minutes,
          sortOrder: row.sortOrder,
          published: row.published,
          skills: { create: row.skills.map((skillNodeId) => ({ skillNodeId })) },
        },
      });
    }

    for (const row of plan.toUpdate) {
      const previousSkills = existingSkillsBySlug.get(row.slug) ?? [];
      const toAdd = row.skills.filter((id) => !previousSkills.includes(id));
      const toRemove = previousSkills.filter((id) => !row.skills.includes(id));

      await tx.lesson.update({
        where: { slug: row.slug },
        data: {
          title: row.title,
          domainId: row.domainId,
          level: row.level,
          minutes: row.minutes,
          sortOrder: row.sortOrder,
          published: row.published,
          skills: {
            deleteMany: toRemove.map((skillNodeId) => ({ skillNodeId })),
            create: toAdd.map((skillNodeId) => ({ skillNodeId })),
          },
        },
      });
    }
  });

  console.log(
    `lesson sync — created: ${plan.toCreate.length}, updated: ${plan.toUpdate.length}, ` +
      `unchanged: ${plan.unchanged.length}`,
  );
}

async function main(): Promise<void> {
  const taxonomyNodes = await syncTaxonomy();
  await syncLessons(taxonomyNodes);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
