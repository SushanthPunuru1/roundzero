// Server-only: reads lesson MDX straight from packages/content (DECISIONS
// 006/007 — content stays out of apps/web, never copied in). Must only be
// imported from server components/actions, never from a "use client" file.

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

export function loadLessonBySlug(slug: string): ParsedLesson | null {
  for (const filePath of listMdxFiles(LESSONS_DIR)) {
    const text = readFileSync(filePath, "utf-8");
    const parsed = parseLesson(text, path.relative(LESSONS_DIR, filePath));
    if (parsed.meta.slug === slug) {
      return parsed;
    }
  }
  return null;
}
