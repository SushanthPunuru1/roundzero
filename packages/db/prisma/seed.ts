// Idempotent sync of packages/content (taxonomy.yaml, lesson frontmatter,
// checklists, drill cards) into the DB index tables. YAML/MDX stays the
// source of truth; this script only upserts rows to match it.
//
// Milestone 1 built taxonomy + lesson sync. Milestone 2 added Season +
// checklist sync. This adds drill card sync (Milestone 3).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { prisma } from "../src/client";
import { parseTaxonomy, type DesiredNode, type NodeKind } from "../src/taxonomy/parse";
import { reconcile, type ExistingNode } from "../src/taxonomy/reconcile";
import { parseLessons, toLessonRow, validateSkillRefs } from "../src/lessons/parse";
import { reconcileLessons, type ExistingLessonRow, type LessonRow } from "../src/lessons/reconcile";
import { parseChecklists, validateChecklistRefs } from "../src/checklists/parse";
import {
  reconcileChecklists,
  type ExistingChecklistItem,
  type ExistingChecklistTemplate,
} from "../src/checklists/reconcile";
import { parseCards, validateCardRefs } from "../src/cards/parse";
import { reconcileCards, type ExistingCard } from "../src/cards/reconcile";
import { parseForensics, toForensicsRow, validateForensicsRefs } from "../src/forensics/parse";
import { reconcileForensics, type ExistingForensicsQuestion } from "../src/forensics/reconcile";
import { parseQuiz, toQuizRow, validateQuizRefs } from "../src/quiz/parse";
import { reconcileQuiz, type ExistingQuizQuestion } from "../src/quiz/reconcile";
import { parsePlacement, validatePlacementCoverage, validatePlacementRefs } from "../src/placement/parse";

const CONTENT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../content",
);
const TAXONOMY_PATH = path.join(CONTENT_DIR, "taxonomy/taxonomy.yaml");
const LESSONS_DIR = path.join(CONTENT_DIR, "lessons");
const CHECKLISTS_DIR = path.join(CONTENT_DIR, "checklists");
const CARDS_PATH = path.join(CONTENT_DIR, "cards/core.yaml");
const FORENSICS_DIR = path.join(CONTENT_DIR, "forensics");
const NETWORKING_QUIZ_DIR = path.join(CONTENT_DIR, "networking-quiz");
const PLACEMENT_DIR = path.join(CONTENT_DIR, "placement");

// The official CyberPatriot season currently in progress. SeasonEvent rows
// (registration/round/state calendar, Appendix B) are seeded later once
// coach planning (Milestone 4) needs them.
const CURRENT_SEASON = { id: "cp-19", title: "CyberPatriot XIX", active: true };

const KIND_ORDER: NodeKind[] = ["DOMAIN", "CATEGORY", "SKILL"];

// Prisma's interactive-transaction default (5s) assumes low-latency DB
// round trips. This environment's round trip to the Neon dev DB runs
// ~200-300ms (plus a multi-second cold-start on the first query after
// idling), so a sync touching many rows in one transaction (e.g. a
// multi-lesson content session) can exceed the default well before doing
// anything wrong. Applied to every syncX transaction below, not just the
// one that hit it, so the next content-heavy session doesn't rediscover it.
const TX_OPTIONS = { timeout: 20_000 };

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
  }, TX_OPTIONS);

  console.log(
    `taxonomy sync — created: ${plan.toCreate.length}, updated: ${plan.toUpdate.length}, ` +
      `deprecated: ${plan.toDeprecate.length}, unchanged: ${plan.unchanged.length}`,
  );

  return desired;
}

async function syncLessons(knownTaxonomyNodes: DesiredNode[]): Promise<Set<string>> {
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
  }, TX_OPTIONS);

  console.log(
    `lesson sync — created: ${plan.toCreate.length}, updated: ${plan.toUpdate.length}, ` +
      `unchanged: ${plan.unchanged.length}`,
  );

  return new Set(desired.map((row) => row.slug));
}

async function syncSeason(): Promise<Set<string>> {
  await prisma.season.upsert({
    where: { id: CURRENT_SEASON.id },
    create: CURRENT_SEASON,
    update: { title: CURRENT_SEASON.title, active: CURRENT_SEASON.active },
  });

  console.log(`season sync — ensured "${CURRENT_SEASON.id}"`);

  const rows = await prisma.season.findMany({ select: { id: true } });
  return new Set(rows.map((row) => row.id));
}

async function syncChecklists(
  knownTaxonomyNodes: DesiredNode[],
  knownLessonSlugs: Set<string>,
  knownSeasonIds: Set<string>,
): Promise<void> {
  const files = readdirSync(CHECKLISTS_DIR)
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => ({
      path: name,
      text: readFileSync(path.join(CHECKLISTS_DIR, name), "utf-8"),
    }));

  const desired = parseChecklists(files);
  validateChecklistRefs(desired, knownTaxonomyNodes, knownLessonSlugs, knownSeasonIds);

  const [existingTemplateRows, existingItemRows] = await Promise.all([
    prisma.checklistTemplate.findMany(),
    prisma.checklistItem.findMany(),
  ]);
  const existingTemplates: ExistingChecklistTemplate[] = existingTemplateRows.map((row) => ({
    id: row.id,
    os: row.os,
    seasonId: row.seasonId,
    version: row.version,
    title: row.title,
  }));
  const existingItems: ExistingChecklistItem[] = existingItemRows.map((row) => ({
    id: row.id,
    templateId: row.templateId,
    skillNodeId: row.skillNodeId,
    sortOrder: row.sortOrder,
    action: row.action,
    why: row.why,
    commands: row.commands as Record<string, string>,
    lessonSlug: row.lessonSlug,
    caution: row.caution,
  }));

  const plan = reconcileChecklists(desired, existingTemplates, existingItems);

  await prisma.$transaction(async (tx) => {
    for (const template of plan.templates.toCreate) {
      await tx.checklistTemplate.create({
        data: {
          id: template.id,
          os: template.os,
          seasonId: template.seasonId,
          version: template.version,
          title: template.title,
        },
      });
    }
    for (const template of plan.templates.toUpdate) {
      await tx.checklistTemplate.update({
        where: { id: template.id },
        data: {
          os: template.os,
          seasonId: template.seasonId,
          version: template.version,
          title: template.title,
        },
      });
    }

    for (const item of plan.items.toCreate) {
      await tx.checklistItem.create({
        data: {
          id: item.id,
          templateId: item.templateId,
          skillNodeId: item.skillNodeId,
          sortOrder: item.sortOrder,
          action: item.action,
          why: item.why,
          commands: item.commands,
          lessonSlug: item.lessonSlug,
          caution: item.caution,
        },
      });
    }
    for (const item of plan.items.toUpdate) {
      await tx.checklistItem.update({
        where: { id: item.id },
        data: {
          templateId: item.templateId,
          skillNodeId: item.skillNodeId,
          sortOrder: item.sortOrder,
          action: item.action,
          why: item.why,
          commands: item.commands,
          lessonSlug: item.lessonSlug,
          caution: item.caution,
        },
      });
    }
    for (const item of plan.items.toRemove) {
      await tx.checklistItem.delete({ where: { id: item.id } });
    }
  }, TX_OPTIONS);

  console.log(
    `checklist sync — templates created: ${plan.templates.toCreate.length}, ` +
      `updated: ${plan.templates.toUpdate.length}, unchanged: ${plan.templates.unchanged.length}; ` +
      `items created: ${plan.items.toCreate.length}, updated: ${plan.items.toUpdate.length}, ` +
      `removed: ${plan.items.toRemove.length}, unchanged: ${plan.items.unchanged.length}`,
  );
}

async function syncCards(knownTaxonomyNodes: DesiredNode[]): Promise<void> {
  const text = readFileSync(CARDS_PATH, "utf-8");
  const desired = parseCards(text);
  validateCardRefs(desired, knownTaxonomyNodes);

  const existingRows = await prisma.drillCard.findMany();
  const existing: ExistingCard[] = existingRows.map((row) => ({
    id: row.id,
    skillNodeId: row.skillNodeId,
    type: row.type,
    front: row.front,
    back: row.back,
    active: row.active,
  }));

  const plan = reconcileCards(desired, existing);

  await prisma.$transaction(async (tx) => {
    for (const card of plan.toCreate) {
      await tx.drillCard.create({
        data: {
          id: card.id,
          skillNodeId: card.skillNodeId,
          type: card.type,
          front: card.front,
          back: card.back,
          active: true,
        },
      });
    }
    for (const card of [...plan.toUpdate, ...plan.toReactivate]) {
      await tx.drillCard.update({
        where: { id: card.id },
        data: {
          skillNodeId: card.skillNodeId,
          type: card.type,
          front: card.front,
          back: card.back,
          active: true,
        },
      });
    }
    for (const card of plan.toDeactivate) {
      await tx.drillCard.update({
        where: { id: card.id },
        data: { active: false },
      });
    }
  }, TX_OPTIONS);

  console.log(
    `card sync — created: ${plan.toCreate.length}, updated: ${plan.toUpdate.length}, ` +
      `deactivated: ${plan.toDeactivate.length}, reactivated: ${plan.toReactivate.length}, ` +
      `unchanged: ${plan.unchanged.length}`,
  );
}

async function syncForensics(knownTaxonomyNodes: DesiredNode[]): Promise<void> {
  const files = readdirSync(FORENSICS_DIR)
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => ({
      path: name,
      text: readFileSync(path.join(FORENSICS_DIR, name), "utf-8"),
    }));

  const parsed = parseForensics(files);
  validateForensicsRefs(parsed, knownTaxonomyNodes);
  const desired = parsed.map(toForensicsRow);

  const existingRows = await prisma.forensicsQuestion.findMany();
  const existing: ExistingForensicsQuestion[] = existingRows.map((row) => ({
    id: row.id,
    archetype: row.archetype,
    skillNodeId: row.skillNodeId,
    prompt: row.prompt,
    given: row.given,
    sortOrder: row.sortOrder,
  }));

  const plan = reconcileForensics(desired, existing);

  await prisma.$transaction(async (tx) => {
    for (const row of plan.toCreate) {
      await tx.forensicsQuestion.create({ data: row });
    }
    for (const row of plan.toUpdate) {
      await tx.forensicsQuestion.update({ where: { id: row.id }, data: row });
    }
    for (const row of plan.toRemove) {
      await tx.forensicsQuestion.delete({ where: { id: row.id } });
    }
  }, TX_OPTIONS);

  console.log(
    `forensics sync — created: ${plan.toCreate.length}, updated: ${plan.toUpdate.length}, ` +
      `removed: ${plan.toRemove.length}, unchanged: ${plan.unchanged.length}`,
  );
}

async function syncQuiz(knownTaxonomyNodes: DesiredNode[]): Promise<void> {
  const files = readdirSync(NETWORKING_QUIZ_DIR)
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => ({
      path: name,
      text: readFileSync(path.join(NETWORKING_QUIZ_DIR, name), "utf-8"),
    }));

  const parsed = parseQuiz(files);
  validateQuizRefs(parsed, knownTaxonomyNodes);
  const desired = parsed.map(toQuizRow);

  const existingRows = await prisma.quizQuestion.findMany();
  const existing: ExistingQuizQuestion[] = existingRows.map((row) => ({
    id: row.id,
    quizId: row.quizId,
    category: row.category,
    skillNodeId: row.skillNodeId,
    prompt: row.prompt,
    given: row.given,
    sortOrder: row.sortOrder,
  }));

  const plan = reconcileQuiz(desired, existing);

  await prisma.$transaction(async (tx) => {
    for (const row of plan.toCreate) {
      await tx.quizQuestion.create({ data: row });
    }
    for (const row of plan.toUpdate) {
      await tx.quizQuestion.update({ where: { id: row.id }, data: row });
    }
    for (const row of plan.toRemove) {
      await tx.quizQuestion.delete({ where: { id: row.id } });
    }
  }, TX_OPTIONS);

  console.log(
    `quiz sync — created: ${plan.toCreate.length}, updated: ${plan.toUpdate.length}, ` +
      `removed: ${plan.toRemove.length}, unchanged: ${plan.unchanged.length}`,
  );
}

// Validation-only — there is no PlacementQuestion table (see
// packages/db/src/placement/ladder.ts's header comment for why). This still
// gives placement content the same "fail loudly on a bad ref at seed time"
// discipline as every other content type; it just has 0 rows to create.
async function syncPlacement(knownTaxonomyNodes: DesiredNode[]): Promise<void> {
  const files = readdirSync(PLACEMENT_DIR)
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => ({
      path: name,
      text: readFileSync(path.join(PLACEMENT_DIR, name), "utf-8"),
    }));

  const parsed = parsePlacement(files);
  validatePlacementRefs(parsed, knownTaxonomyNodes);
  validatePlacementCoverage(parsed);

  console.log(`placement bank validated — ${parsed.length} questions, 0 DB rows (content-only, no sync)`);
}

async function main(): Promise<void> {
  const taxonomyNodes = await syncTaxonomy();
  const lessonSlugs = await syncLessons(taxonomyNodes);
  const seasonIds = await syncSeason();
  await syncChecklists(taxonomyNodes, lessonSlugs, seasonIds);
  await syncCards(taxonomyNodes);
  await syncForensics(taxonomyNodes);
  await syncQuiz(taxonomyNodes);
  await syncPlacement(taxonomyNodes);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
