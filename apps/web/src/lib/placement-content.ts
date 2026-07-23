// Server-only: reads the placement question bank straight from
// packages/content (DECISIONS 006/007 — content stays out of apps/web, never
// copied in). The answer key lives only in this parsed result — never pass a
// DesiredPlacementQuestion straight to a client component; strip it down with
// toPublicQuestion first. Must only be imported from server
// components/actions, never from a "use client" file.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parsePlacement, type DesiredPlacementQuestion } from "@roundzero/db";

// Offset matches outputFileTracingIncludes in next.config.ts, which ships
// this directory in the Vercel function bundle relative to the same root.
const PLACEMENT_DIR = path.join(process.cwd(), "../../packages/content/placement");

export function loadPlacementBank(): DesiredPlacementQuestion[] {
  const files = readdirSync(PLACEMENT_DIR)
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => ({ path: name, text: readFileSync(path.join(PLACEMENT_DIR, name), "utf-8") }));
  return parsePlacement(files);
}
