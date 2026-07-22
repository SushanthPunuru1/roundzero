// Server-only: reads the networking quiz bank straight from packages/content
// (DECISIONS 006/007/033 — content stays out of apps/web, never copied in).
// The answer key lives only in this parsed result — never pass a
// DesiredQuizQuestion straight to a client component; strip it down to
// {id, prompt, given} first. Must only be imported from server
// components/actions, never from a "use client" file. Mirrors
// forensics-content.ts, scoped to quizId "networking".

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseQuiz, type DesiredQuizQuestion } from "@roundzero/db";

const NETWORKING_QUIZ_ID = "networking";

// Offset matches outputFileTracingIncludes in next.config.ts, which ships
// this directory in the Vercel function bundle relative to the same root.
const NETWORKING_QUIZ_DIR = path.join(process.cwd(), "../../packages/content/networking-quiz");

export interface NetworkingQuizCategoryInfo {
  key: string; // kebab-case — used in content YAML and the /app/networking/[category] route
  label: string;
}

/** The 6 known categories, ordered for the index page. */
export const NETWORKING_QUIZ_CATEGORIES: NetworkingQuizCategoryInfo[] = [
  { key: "subnetting", label: "Subnetting" },
  { key: "ports", label: "Ports" },
  { key: "protocols", label: "Protocol concepts" },
  { key: "ios-commands", label: "IOS command recall" },
  { key: "security", label: "Security" },
  { key: "vlan-acl", label: "VLAN / ACL concepts" },
];

function listNetworkingQuizFiles(): { path: string; text: string }[] {
  return readdirSync(NETWORKING_QUIZ_DIR)
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => ({ path: name, text: readFileSync(path.join(NETWORKING_QUIZ_DIR, name), "utf-8") }));
}

export function loadNetworkingQuizQuestions(): DesiredQuizQuestion[] {
  return parseQuiz(listNetworkingQuizFiles()).filter((q) => q.quizId === NETWORKING_QUIZ_ID);
}

/** The ordered question set for one category, or null if it isn't a known
 * category. */
export function loadNetworkingQuizSet(category: string): DesiredQuizQuestion[] | null {
  if (!NETWORKING_QUIZ_CATEGORIES.some((c) => c.key === category)) return null;

  return loadNetworkingQuizQuestions()
    .filter((question) => question.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function findNetworkingQuizQuestion(id: string): DesiredQuizQuestion | null {
  return loadNetworkingQuizQuestions().find((question) => question.id === id) ?? null;
}
