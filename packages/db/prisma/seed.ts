// Idempotent sync of packages/content (taxonomy.yaml, lesson frontmatter,
// checklists, drill cards) into the DB index tables. YAML/MDX stays the
// source of truth; this script only upserts rows to match it.
//
// TODO: implement taxonomy + lesson sync (Milestone 1 roadmap item).
// Stubbed here so `pnpm db:seed` has a real entry point to build against.

async function main(): Promise<void> {
  console.log("db:seed — not yet implemented");
}

main();
