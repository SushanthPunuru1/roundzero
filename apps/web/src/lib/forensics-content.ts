// Server-only: reads the forensics question bank straight from
// packages/content (DECISIONS 006/007 — content stays out of apps/web, never
// copied in). The answer key lives only in this parsed result — never pass a
// DesiredForensicsQuestion straight to a client component; strip it down to
// {id, prompt, given} first. Must only be imported from server
// components/actions, never from a "use client" file.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { FORENSICS_ARCHETYPES, parseForensics, type DesiredForensicsQuestion } from "@roundzero/db";

// Offset matches outputFileTracingIncludes in next.config.ts, which ships
// this directory in the Vercel function bundle relative to the same root.
const FORENSICS_DIR = path.join(process.cwd(), "../../packages/content/forensics");

function listForensicsFiles(): { path: string; text: string }[] {
  return readdirSync(FORENSICS_DIR)
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => ({ path: name, text: readFileSync(path.join(FORENSICS_DIR, name), "utf-8") }));
}

export function loadForensicsQuestions(): DesiredForensicsQuestion[] {
  return parseForensics(listForensicsFiles());
}

/** The ordered question set for one archetype (by its kebab-case key), or
 * null if the key isn't one of the known archetypes. */
export function loadForensicsSet(archetypeKey: string): DesiredForensicsQuestion[] | null {
  const info = FORENSICS_ARCHETYPES.find((archetype) => archetype.key === archetypeKey);
  if (!info) return null;

  return loadForensicsQuestions()
    .filter((question) => question.archetype === info.value)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function findForensicsQuestion(id: string): DesiredForensicsQuestion | null {
  return loadForensicsQuestions().find((question) => question.id === id) ?? null;
}
