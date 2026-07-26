// The recommended-track generator (ONBOARDING_PATH_SPEC.md Part B) — pure,
// no DB/framework/fs imports, sibling to placement/ladder.ts. Given a user's
// placement levels + what they've completed + the published lesson set, it
// derives an ordered queue of typed next-steps. Derived ON READ (per the
// spec's "no persistence" call): always fresh, no staleness bugs. The
// Prisma + content glue that loads the inputs and calls this lives in
// apps/web/src/lib/track.ts (mirrors how loadDrill wraps dueCards).
//
// Design calls (signed off, see DECISIONS 037):
// - Focus-machine lesson window is `level >= placement level for that domain`,
//   ordered by (levelRank, sortOrder). sortOrder already encodes intended
//   progression (advanced lessons sort last), so this honors "at or just
//   above" in practice while keeping rule 5 ("never end") clean — the queue
//   naturally contains everything up to the top tier, revealed in order.
// - The lab gate is robust to an empty prerequisite set: it prefers real
//   published Linux lessons when they exist, and falls back to a placement/
//   Foundations proxy while none do (today's repo state), so the lab never
//   surfaces cold for a total beginner.

import type { TrackLevel } from "../taxonomy/parse";

/** A machine the user self-reported focusing on (Placement.focus). "cisco"
 * maps to the "networking" taxonomy domain; "unsure" (or an empty focus)
 * expands to all machines. */
export type FocusMachine = "windows" | "linux" | "cisco" | "unsure";

/** The domains placement assigns a level to (foundations + the 3 machines). */
export type TrackDomain = "foundations" | "linux" | "windows" | "networking";

export type TrackStepKind = "lesson" | "drill" | "quiz" | "subnetting" | "checklist" | "lab";

/** Whether a step is actionable right now, or gated on something the user
 * controls locally. Only the lab uses "available-when-runnable" — it runs in
 * a local Docker container and is not wired on the production deploy, so the
 * track presents it honestly rather than as a link that dead-ends. */
export type TrackStepStatus = "ready" | "available-when-runnable";

export interface TrackStep {
  kind: TrackStepKind;
  /** Stable content reference, kind-specific: a lesson slug; "daily" for the
   * drill; "networking" / "forensics" for a quiz index; a category-scoped
   * "networking:ports"; "subnetting"; a checklist template id ("linux-core");
   * "linux-practice" for the lab. Routing (href) is resolved in apps/web, not
   * here — this stays framework-free. */
  ref: string;
  title: string;
  /** One-line, plain-language "why this, why now" — surfaced verbatim on the
   * dashboard. Warm, never a rank or a score (spec copy principle). */
  reason: string;
  status: TrackStepStatus;
}

export interface TrackLesson {
  slug: string;
  title: string;
  domainId: string; // top-level SkillNode id: "foundations" | "linux" | ...
  level: TrackLevel;
  sortOrder: number;
}

export interface TrackInput {
  /** Normalized self-reported focus. Empty or ["unsure"] → all machines. */
  focus: FocusMachine[];
  /** Per-domain placement levels, or null when the user hasn't placed yet —
   * null is treated as a beginner (every domain FOUNDATIONS) so a user who
   * skips placement still gets a sensible Foundations-first track. */
  levels: Record<TrackDomain, TrackLevel> | null;
  /** Published lessons only. */
  lessons: TrackLesson[];
  /** Completed lesson slugs. */
  completed: Set<string>;
  /** Cards due for review right now (from countDueCards). Gates the
   * interleaved drill step; the never-empty floor shows a drill regardless. */
  dueCardCount: number;
}

const LEVEL_RANK: Record<TrackLevel, number> = { FOUNDATIONS: 0, STANDARD: 1, ADVANCED: 2 };

/** Focus machine → taxonomy domain id. */
const FOCUS_TO_DOMAIN: Record<Exclude<FocusMachine, "unsure">, TrackDomain> = {
  windows: "windows",
  linux: "linux",
  cisco: "networking",
};

/** Deterministic order machines are worked through when focus is "unsure" or
 * multi-select: Linux first (the Phase 2 lab machine and the platform's
 * primary target), then Windows, then Networking/Cisco. */
const ALL_MACHINE_DOMAINS: TrackDomain[] = ["linux", "windows", "networking"];

const DOMAIN_LABEL: Record<TrackDomain, string> = {
  foundations: "Foundations",
  linux: "Linux",
  windows: "Windows",
  networking: "Networking",
};

function levelLabel(level: TrackLevel): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

/** Resolves the ordered, de-duplicated list of machine domains a track should
 * cover from the user's focus. "unsure"/empty → all machines. */
export function resolveFocusDomains(focus: FocusMachine[]): TrackDomain[] {
  if (focus.length === 0 || focus.includes("unsure")) {
    return ALL_MACHINE_DOMAINS;
  }
  const domains: TrackDomain[] = [];
  for (const machine of ALL_MACHINE_DOMAINS) {
    // iterate in canonical order so output order is stable regardless of the
    // order the user picked machines in
    const picked = focus.some((f) => f !== "unsure" && FOCUS_TO_DOMAIN[f] === machine);
    if (picked) domains.push(machine);
  }
  return domains;
}

function lessonStep(lesson: TrackLesson, reason: string): TrackStep {
  return { kind: "lesson", ref: lesson.slug, title: lesson.title, reason, status: "ready" };
}

function bySortThenLevel(a: TrackLesson, b: TrackLesson): number {
  const level = LEVEL_RANK[a.level] - LEVEL_RANK[b.level];
  return level !== 0 ? level : a.sortOrder - b.sortOrder;
}

/**
 * Decides whether the Linux lab is ready to appear. Rule 4: after the Linux
 * fundamentals lessons, never before, never never.
 *
 * Prefers real content: if any Linux lessons at FOUNDATIONS/STANDARD level are
 * published, the gate is "all of them complete". When none are (today's repo
 * has zero Linux lessons — see DECISIONS 037), a placement/Foundations proxy
 * stands in so the lab never surfaces cold for a beginner: demonstrated Linux
 * ability (placement >= STANDARD) OR every published Foundations lesson done.
 */
export function linuxLabReady(
  lessons: TrackLesson[],
  completed: Set<string>,
  linuxLevel: TrackLevel,
): boolean {
  const linuxPrereqs = lessons.filter(
    (l) => l.domainId === "linux" && LEVEL_RANK[l.level] <= LEVEL_RANK.STANDARD,
  );
  if (linuxPrereqs.length > 0) {
    return linuxPrereqs.every((l) => completed.has(l.slug));
  }
  // No Linux lessons exist yet — fall back to the proxy.
  if (LEVEL_RANK[linuxLevel] >= LEVEL_RANK.STANDARD) return true;
  const foundationsLessons = lessons.filter((l) => l.domainId === "foundations");
  return foundationsLessons.length > 0 && foundationsLessons.every((l) => completed.has(l.slug));
}

const LAB_STEP: TrackStep = {
  kind: "lab",
  ref: "linux-practice",
  title: "Practice Linux lab",
  reason: "You've got the fundamentals — harden a real machine when you can run it locally.",
  status: "available-when-runnable",
};

function drillStep(reason: string): TrackStep {
  return { kind: "drill", ref: "daily", title: "Daily drill", reason, status: "ready" };
}

/** The relevant trainer/quiz to interleave after a domain's lessons, if that
 * domain has one. Only Networking has quiz/trainer content today. */
function trainerStepsForDomain(domain: TrackDomain): TrackStep[] {
  if (domain === "networking") {
    return [
      {
        kind: "subnetting",
        ref: "subnetting",
        title: "Subnetting trainer",
        reason: "Subnetting is muscle memory — a few reps lock it in.",
        status: "ready",
      },
      {
        kind: "quiz",
        ref: "networking",
        title: "Networking quiz",
        reason: "Check what stuck from the networking lessons.",
        status: "ready",
      },
    ];
  }
  return [];
}

/**
 * Generates the ordered recommended track. Pure and total: returns a
 * non-empty list for every valid input (the never-empty floor below).
 */
export function generateTrack(input: TrackInput): TrackStep[] {
  const levels: Record<TrackDomain, TrackLevel> = input.levels ?? {
    foundations: "FOUNDATIONS",
    linux: "FOUNDATIONS",
    windows: "FOUNDATIONS",
    networking: "FOUNDATIONS",
  };
  const { completed, lessons, dueCardCount } = input;
  const isBeginner = levels.foundations === "FOUNDATIONS";

  const incompleteInDomain = (domain: string): TrackLesson[] =>
    lessons.filter((l) => l.domainId === domain && !completed.has(l.slug)).sort(bySortThenLevel);

  // The lesson spine, in track order, tagged with the domain it came from so
  // interleaving can pick a relevant trainer.
  const spine: { lesson: TrackLesson; reason: string; domain: TrackDomain }[] = [];
  const queuedSlugs = new Set<string>();

  const pushLesson = (lesson: TrackLesson, reason: string, domain: TrackDomain) => {
    if (queuedSlugs.has(lesson.slug)) return;
    queuedSlugs.add(lesson.slug);
    spine.push({ lesson, reason, domain });
  };

  // Rule 1 — Foundations gate. A beginner (or an un-placed user) always gets
  // the Foundations lessons first: nobody hits "harden SSH" before "what is a
  // service".
  if (isBeginner) {
    for (const lesson of incompleteInDomain("foundations")) {
      pushLesson(lesson, "Start here — this builds the vocabulary everything else uses.", "foundations");
    }
  }

  // Rule 2 — Focus-machine lessons, level >= placement for that domain.
  const focusDomains = resolveFocusDomains(input.focus);
  for (const domain of focusDomains) {
    const placementLevel = levels[domain];
    const machineLessons = incompleteInDomain(domain).filter(
      (l) => LEVEL_RANK[l.level] >= LEVEL_RANK[placementLevel],
    );
    for (const lesson of machineLessons) {
      pushLesson(
        lesson,
        `You placed at ${levelLabel(placementLevel)} for ${DOMAIN_LABEL[domain]} — ${levelLabel(lesson.level)} lesson.`,
        domain,
      );
    }
  }

  // Rules 2+3 — walk the spine into steps, interleaving practice after every
  // 2 lessons. Avoid pushing a practice step whose kind+ref repeats the step
  // immediately before it.
  const steps: TrackStep[] = [];
  const pushStep = (step: TrackStep) => {
    const prev = steps[steps.length - 1];
    if (prev && prev.kind === step.kind && prev.ref === step.ref) return;
    steps.push(step);
  };

  let sinceInterleave = 0;
  for (const entry of spine) {
    steps.push(lessonStep(entry.lesson, entry.reason));
    sinceInterleave += 1;
    if (sinceInterleave >= 2) {
      sinceInterleave = 0;
      if (dueCardCount > 0) {
        pushStep(drillStep(`${dueCardCount} card${dueCardCount === 1 ? "" : "s"} due — a quick recall break beats re-reading.`));
      }
      for (const trainer of trainerStepsForDomain(entry.domain)) pushStep(trainer);
    }
  }

  // Rule 4 — the Linux lab, once fundamentals are done.
  if (linuxLabReady(lessons, completed, levels.linux)) {
    pushStep(LAB_STEP);
  }

  // Rule 5 — never end. If the lesson spine was empty (everything at/above the
  // user's level is complete), expand to any remaining incomplete lessons in
  // other domains, then fall to a keep-sharp floor. The result is provably
  // non-empty for any valid input.
  if (spine.length === 0) {
    const coveredDomains = new Set<TrackDomain>(["foundations", ...focusDomains]);
    const allDomains: TrackDomain[] = ["foundations", ...ALL_MACHINE_DOMAINS];
    const expansionDomains = allDomains.filter((d) => !coveredDomains.has(d));
    for (const domain of expansionDomains) {
      for (const lesson of incompleteInDomain(domain)) {
        pushStep(
          lessonStep(
            lesson,
            `You're through your focus track — branch into ${DOMAIN_LABEL[domain]} next.`,
          ),
        );
      }
    }
  }

  if (steps.length === 0 || !steps.some((s) => s.kind === "lesson")) {
    // Keep-sharp floor — reached when every relevant lesson is complete. Never
    // a dead end: review recall, revisit the checklist, sharpen a quiz.
    pushStep(drillStep("You're through the lessons — keep your recall sharp."));
    pushStep({
      kind: "checklist",
      ref: "linux-core",
      title: "Linux hardening checklist",
      reason: "Run the canonical checklist end to end to find what you'd miss under time.",
      status: "ready",
    });
    pushStep({
      kind: "quiz",
      ref: "forensics",
      title: "Forensics practice",
      reason: "Forensics points come early and cheap — keep them fast.",
      status: "ready",
    });
    if (linuxLabReady(lessons, completed, levels.linux)) pushStep(LAB_STEP);
  }

  return steps;
}
