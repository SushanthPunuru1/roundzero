// Idempotent sync of packages/content (taxonomy.yaml, lesson frontmatter,
// checklists, drill cards) into the DB index tables. YAML/MDX stays the
// source of truth; this script only upserts rows to match it.
//
// Milestone 1 implements taxonomy sync only. Lesson/checklist/card sync are
// later roadmap items — not built here.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { prisma } from "../src/client";
import { parseTaxonomy, type DesiredNode, type NodeKind } from "../src/taxonomy/parse";
import { reconcile, type ExistingNode } from "../src/taxonomy/reconcile";

const TAXONOMY_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../content/taxonomy/taxonomy.yaml",
);

const KIND_ORDER: NodeKind[] = ["DOMAIN", "CATEGORY", "SKILL"];

async function syncTaxonomy(): Promise<void> {
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
}

async function main(): Promise<void> {
  await syncTaxonomy();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
