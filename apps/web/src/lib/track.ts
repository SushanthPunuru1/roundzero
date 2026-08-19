// Prisma + content glue for the recommended track (ONBOARDING_PATH_SPEC.md
// Part B / C). The pure generation logic lives in @roundzero/db
// (packages/db/src/track/generate.ts) — this module only loads the inputs
// (placement + progress + published lessons) and resolves routing, exactly
// how apps/web/src/lib/drill.ts wraps the pure SRS selection.
//
// The `hrefForStep`, `normalizeFocus`, `normalizeLevels`, and `aggregatePillars`
// helpers are pure and unit-tested in track.test.ts; the `load*` functions are
// the thin Prisma layer.

import {
  generateTrack,
  prisma,
  type FocusMachine,
  type TrackDomain,
  type TrackLevel,
  type TrackStep,
} from "@roundzero/db";

import { countDueCards } from "./drill";
import { loadLessonWhyIndex } from "./lesson-content";
import type { NextStepView } from "@/app/app/next-step-card";

const FOCUS_VALUES = new Set<FocusMachine>(["windows", "linux", "cisco", "unsure"]);
const LEVEL_VALUES = new Set<TrackLevel>(["FOUNDATIONS", "STANDARD", "ADVANCED"]);
const TRACK_DOMAINS: TrackDomain[] = ["foundations", "linux", "windows", "networking"];

/** Coerces the stored Placement.focus JSON (string[]) to typed focus machines,
 * dropping anything unrecognized. An empty/garbage result becomes ["unsure"]
 * so the generator expands to all machines rather than producing nothing. */
export function normalizeFocus(raw: unknown): FocusMachine[] {
  if (!Array.isArray(raw)) return ["unsure"];
  const focus = raw.filter((v): v is FocusMachine => typeof v === "string" && FOCUS_VALUES.has(v as FocusMachine));
  return focus.length > 0 ? focus : ["unsure"];
}

/** Coerces the stored Placement.levels JSON to a full per-domain level record,
 * defaulting any missing/invalid domain to FOUNDATIONS. Returns null only when
 * the whole placement is absent (the generator treats null as a beginner). */
export function normalizeLevels(raw: unknown): Record<TrackDomain, TrackLevel> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const levels = {} as Record<TrackDomain, TrackLevel>;
  for (const domain of TRACK_DOMAINS) {
    const value = source[domain];
    levels[domain] = typeof value === "string" && LEVEL_VALUES.has(value as TrackLevel)
      ? (value as TrackLevel)
      : "FOUNDATIONS";
  }
  return levels;
}

/** Resolves the route a track step's single-click action navigates to. Kept
 * out of the pure generator so that stays framework-free. */
export function hrefForStep(step: TrackStep): string {
  switch (step.kind) {
    case "lesson":
      return `/app/lessons/${step.ref}`;
    case "drill":
      return "/app/drill";
    case "subnetting":
      return "/app/subnetting";
    case "checklist":
      return `/app/checklists/${step.ref}`;
    case "lab":
      return "/app/lab";
    case "quiz": {
      // "networking" | "forensics" | "networking:ports"
      const [quizId, category] = step.ref.split(":");
      const base = quizId === "forensics" ? "/app/forensics" : `/app/${quizId}`;
      return category ? `${base}/${category}` : base;
    }
  }
}

export interface LoadedTrack {
  steps: TrackStep[];
  hasPlacement: boolean;
}

/**
 * Loads and generates the user's recommended track. `alsoCompleted` lets a
 * completion surface (e.g. a lesson page) treat the item just finished as done
 * so the "Next up" it shows is the *following* step, without waiting on a
 * revalidation round trip.
 */
export async function loadTrack(userId: string, alsoCompleted: string[] = []): Promise<LoadedTrack> {
  const [placement, lessonRows, progress, dueCardCount] = await Promise.all([
    prisma.placement.findUnique({ where: { userId } }),
    prisma.lesson.findMany({
      where: { published: true },
      select: { slug: true, title: true, domainId: true, level: true, minutes: true, sortOrder: true },
    }),
    prisma.lessonProgress.findMany({ where: { userId }, select: { lessonSlug: true } }),
    countDueCards(userId),
  ]);

  const completed = new Set<string>([...progress.map((p) => p.lessonSlug), ...alsoCompleted]);

  // The DB row is the index (what's published, at what level, in what order);
  // the authored `why` comes from the MDX frontmatter it was indexed from.
  const whyBySlug = loadLessonWhyIndex();
  const lessons = lessonRows.map((row) => ({ ...row, why: whyBySlug.get(row.slug) ?? null }));

  const steps = generateTrack({
    focus: normalizeFocus(placement?.focus),
    levels: placement ? normalizeLevels(placement.levels) : null,
    lessons,
    completed,
    dueCardCount,
    onMissingWhy: (slug) => {
      // Unreachable for well-formed content: `why` is a required frontmatter
      // field, so this only fires if a DB Lesson row has no matching MDX file
      // (a stale index — the seed was not re-run after content moved).
      console.warn(
        `[track] lesson "${slug}" has no authored \`why\` in frontmatter; ` +
          `falling back to a generic reason. Re-run \`pnpm db:seed\` if the lesson was removed or renamed.`,
      );
    },
  });

  return { steps, hasPlacement: placement !== null };
}

/** The top N steps for the dashboard "Next up" hero. */
export function topSteps(steps: TrackStep[], n = 3): TrackStep[] {
  return steps.slice(0, n);
}

/** Resolves a pure TrackStep into the serializable, routed view the
 * NextStepCard renders (safe to hand to a client component). */
export function toStepView(step: TrackStep): NextStepView {
  return {
    kind: step.kind,
    title: step.title,
    reason: step.reason,
    pillar: step.pillar,
    minutes: step.minutes,
    href: hrefForStep(step),
    status: step.status,
  };
}

/** The single next step to show inline after finishing something — the first
 * step that isn't the item just completed. Returns null only in the degenerate
 * case of an empty track (the generator guarantees this won't happen). */
export function nextStepView(steps: TrackStep[]): NextStepView | null {
  const step = steps[0];
  return step ? toStepView(step) : null;
}

// --- Cross-pillar progress -----------------------------------------------

export interface PillarProgress {
  domain: string;
  label: string;
  lessonsDone: number;
  lessonsTotal: number;
  /** A secondary, honest signal where one exists (quiz avg, best round). */
  detail: string | null;
}

interface PillarInputs {
  lessons: { domainId: string; slug: string }[];
  completedSlugs: Set<string>;
  networkingQuizScores: number[]; // QuizProgress bestScore, quizId "networking"
  subnettingBest: number | null; // QuizProgress bestScore, quizId "subnetting"
  forensicsScores: number[]; // ForensicsProgress bestScore across archetypes
}

// Exported so other cross-pillar aggregations (e.g. lib/season-plan.ts's
// coach-facing plan) share this one list rather than growing their own copy
// that can drift from it.
export const PILLAR_LABELS: Record<string, string> = {
  foundations: "Foundations",
  linux: "Linux",
  windows: "Windows",
  networking: "Networking",
  forensics: "Forensics",
  scripting: "Scripting",
  meta: "Meta",
};
export const PILLAR_ORDER = ["foundations", "linux", "windows", "networking", "forensics", "scripting", "meta"];

/** Mean, rounded. Returns null for an empty set rather than NaN — callers
 * guard today, but `Math.round(0/0)` is a landmine one refactor away. */
function avg(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

/** Pure aggregation — builds the compact per-pillar progress view. Honest, not
 * gamified: raw completion counts and real averages, nothing invented. */
export function aggregatePillars(inputs: PillarInputs): PillarProgress[] {
  const totalByDomain = new Map<string, number>();
  const doneByDomain = new Map<string, number>();
  for (const lesson of inputs.lessons) {
    totalByDomain.set(lesson.domainId, (totalByDomain.get(lesson.domainId) ?? 0) + 1);
    if (inputs.completedSlugs.has(lesson.slug)) {
      doneByDomain.set(lesson.domainId, (doneByDomain.get(lesson.domainId) ?? 0) + 1);
    }
  }

  return PILLAR_ORDER.map((domain) => {
    let detail: string | null = null;
    if (domain === "networking") {
      const parts: string[] = [];
      const quizAvg = avg(inputs.networkingQuizScores);
      if (quizAvg !== null) parts.push(`${quizAvg}% quiz avg`);
      if (inputs.subnettingBest !== null) parts.push(`subnetting best ${inputs.subnettingBest}%`);
      detail = parts.length > 0 ? parts.join(" · ") : null;
    } else if (domain === "forensics") {
      const quizAvg = avg(inputs.forensicsScores);
      detail = quizAvg !== null ? `${quizAvg}% quiz avg` : null;
    }
    return {
      domain,
      label: PILLAR_LABELS[domain]!,
      lessonsDone: doneByDomain.get(domain) ?? 0,
      lessonsTotal: totalByDomain.get(domain) ?? 0,
      detail,
    };
  });
}

/** The one aggregate number that anchors "Where you stand" — without it the
 * section is five ratios and no answer to "how am I doing overall". */
export function totalProgress(pillars: PillarProgress[]): { done: number; total: number } {
  return pillars.reduce(
    (acc, pillar) => ({ done: acc.done + pillar.lessonsDone, total: acc.total + pillar.lessonsTotal }),
    { done: 0, total: 0 },
  );
}

/** Loads the cross-pillar progress view for the dashboard. */
export async function loadPillarProgress(userId: string): Promise<PillarProgress[]> {
  const [lessons, progress, quizProgress, forensicsProgress] = await Promise.all([
    prisma.lesson.findMany({ where: { published: true }, select: { domainId: true, slug: true } }),
    prisma.lessonProgress.findMany({ where: { userId }, select: { lessonSlug: true } }),
    prisma.quizProgress.findMany({ where: { userId }, select: { quizId: true, bestScore: true } }),
    prisma.forensicsProgress.findMany({ where: { userId }, select: { bestScore: true } }),
  ]);

  return aggregatePillars({
    lessons,
    completedSlugs: new Set(progress.map((p) => p.lessonSlug)),
    networkingQuizScores: quizProgress.filter((q) => q.quizId === "networking").map((q) => q.bestScore),
    subnettingBest: quizProgress.find((q) => q.quizId === "subnetting")?.bestScore ?? null,
    forensicsScores: forensicsProgress.map((f) => f.bestScore),
  });
}
