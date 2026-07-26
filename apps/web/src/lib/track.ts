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
  const [placement, lessons, progress, dueCardCount] = await Promise.all([
    prisma.placement.findUnique({ where: { userId } }),
    prisma.lesson.findMany({
      where: { published: true },
      select: { slug: true, title: true, domainId: true, level: true, sortOrder: true },
    }),
    prisma.lessonProgress.findMany({ where: { userId }, select: { lessonSlug: true } }),
    countDueCards(userId),
  ]);

  const completed = new Set<string>([...progress.map((p) => p.lessonSlug), ...alsoCompleted]);

  const steps = generateTrack({
    focus: normalizeFocus(placement?.focus),
    levels: placement ? normalizeLevels(placement.levels) : null,
    lessons,
    completed,
    dueCardCount,
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

const PILLAR_LABELS: Record<string, string> = {
  foundations: "Foundations",
  linux: "Linux",
  windows: "Windows",
  networking: "Networking",
  forensics: "Forensics",
};
const PILLAR_ORDER = ["foundations", "linux", "windows", "networking", "forensics"];

function avg(scores: number[]): number {
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
      if (inputs.networkingQuizScores.length > 0) parts.push(`${avg(inputs.networkingQuizScores)}% quiz avg`);
      if (inputs.subnettingBest !== null) parts.push(`subnetting best ${inputs.subnettingBest}%`);
      detail = parts.length > 0 ? parts.join(" · ") : null;
    } else if (domain === "forensics") {
      detail = inputs.forensicsScores.length > 0 ? `${avg(inputs.forensicsScores)}% quiz avg` : null;
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
