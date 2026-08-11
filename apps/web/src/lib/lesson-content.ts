// Server-only: reads lesson MDX straight from packages/content (DECISIONS
// 006/007 — content stays out of apps/web, never copied in). Must only be
// imported from server components/actions, never from a "use client" file.
//
// DECISIONS 038 added the per-lesson `why` line, which the track generator
// needs for EVERY queued lesson, not just the one being rendered. The old
// linear scan (readdir + read + parse every file until the slug matched) was
// fine for one lesson page; doing it per track step would be ~27 file reads
// per queued lesson. So the module now parses the lesson set once per server
// process and memoizes it — content is immutable at runtime, so a process-
// lifetime cache is always correct, and the lesson page gets the speedup for
// free.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseLesson, type ParsedLesson } from "@roundzero/db";

// Offset matches outputFileTracingIncludes in next.config.ts, which ships
// this directory in the Vercel function bundle relative to the same root.
const LESSONS_DIR = path.join(process.cwd(), "../../packages/content/lessons");

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

let cachedIndex: Map<string, ParsedLesson> | null = null;

/** Every parsed lesson, keyed by slug. Parsed once per process. */
function lessonIndex(): Map<string, ParsedLesson> {
  if (cachedIndex) return cachedIndex;
  const index = new Map<string, ParsedLesson>();
  for (const filePath of listMdxFiles(LESSONS_DIR)) {
    const text = readFileSync(filePath, "utf-8");
    const parsed = parseLesson(text, path.relative(LESSONS_DIR, filePath));
    index.set(parsed.meta.slug, parsed);
  }
  cachedIndex = index;
  return index;
}

export function loadLessonBySlug(slug: string): ParsedLesson | null {
  return lessonIndex().get(slug) ?? null;
}

/**
 * slug → authored `why` line, for the track generator. Reading this from
 * content rather than a Postgres column is deliberate: `why` is prose that
 * belongs with the lesson, and CLAUDE.md's rule is that DB rows are an index
 * of content, never the source of truth for it. It also means the field
 * shipped with no migration and no seed-ordering hazard on deploy.
 */
export function loadLessonWhyIndex(): Map<string, string> {
  const whys = new Map<string, string>();
  for (const [slug, parsed] of lessonIndex()) {
    whys.set(slug, parsed.meta.why);
  }
  return whys;
}
