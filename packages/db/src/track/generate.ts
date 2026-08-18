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
  /**
   * One-line, plain-language "why this, why now" — surfaced verbatim on the
   * dashboard. Warm, never a rank or a score (spec copy principle).
   *
   * MUST be a property of the individual step, never of the bucket it came
   * from. Until DECISIONS 038 this was a per-loop constant, so the top three
   * steps of a beginner's track were three cards carrying one identical
   * sentence. For lessons the text is authored per lesson in MDX frontmatter
   * (`why:`); every other kind is a singleton step with its own line.
   */
  reason: string;
  /** Human pillar label for the step's eyebrow ("Foundations", "Networking").
   * Carries more than the old kind label did: the kind is already obvious
   * from the icon, the pillar is not. */
  pillar: string;
  /** Honest time cost in minutes where one is known (lessons author it in
   * frontmatter), null where inventing a number would be a lie. */
  minutes: number | null;
  status: TrackStepStatus;
}

export interface TrackLesson {
  slug: string;
  title: string;
  /** Authored per-lesson reason from MDX frontmatter. Optional at the type
   * level only so a caller that genuinely has no content index still type
   * checks; a missing value fires `onMissingWhy` and falls back. */
  why?: string | null;
  domainId: string; // top-level SkillNode id: "foundations" | "linux" | ...
  level: TrackLevel;
  minutes: number;
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
  /**
   * Called with the slug of any lesson queued without an authored `why`.
   * The generator stays pure — the caller decides how to report it (apps/web
   * logs a warning). Reaching this means a content bug: `why` is required by
   * the lesson parser, so a populated content set can never trigger it.
   */
  onMissingWhy?: (slug: string) => void;
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

/**
 * Preferred order for Rule 5's expansion — deterministic traversal only,
 * NEVER a whitelist. Placement doesn't test forensics/scripting/meta, so
 * they (rightly) never enter the spine via Rule 1/2, but they still have to
 * surface once a student clears their focus track — see resolveExpansionDomains.
 * A domain missing from this list still gets swept in (alphabetically, after
 * these), so a new taxonomy domain reaches its readers the moment it has a
 * published lesson, with no edit here required.
 */
const DOMAIN_EXPANSION_ORDER: string[] = ["linux", "windows", "networking", "forensics", "scripting", "meta"];

/**
 * Every domain that actually has a published lesson, minus what's already
 * covered by Rule 1 (foundations) and Rule 2 (the focus machines) — ordered
 * by DOMAIN_EXPANSION_ORDER where known, alphabetically for anything new.
 * Driven entirely by `lessons`, the real published set, rather than a
 * hardcoded domain list: that's what used to leave forensics/scripting/meta
 * lessons unreachable once TRACK_DOMAINS/ALL_MACHINE_DOMAINS didn't mention
 * them.
 */
function resolveExpansionDomains(lessons: TrackLesson[], coveredDomains: Set<string>): string[] {
  const present = Array.from(new Set(lessons.map((l) => l.domainId)));
  const known = DOMAIN_EXPANSION_ORDER.filter((d) => present.includes(d));
  const rest = present.filter((d) => !DOMAIN_EXPANSION_ORDER.includes(d)).sort();
  return [...known, ...rest].filter((d) => !coveredDomains.has(d));
}

const DOMAIN_LABEL: Record<TrackDomain, string> = {
  foundations: "Foundations",
  linux: "Linux",
  windows: "Windows",
  networking: "Networking",
};

/** Pillar label for any domain id, including ones outside TrackDomain
 * (e.g. "forensics"), so a step's eyebrow is never blank. */
function pillarLabel(domainId: string): string {
  return DOMAIN_LABEL[domainId as TrackDomain] ?? domainId.charAt(0).toUpperCase() + domainId.slice(1);
}

/**
 * The last-resort reason for a lesson whose frontmatter `why` is missing.
 * Deliberately the only generic lesson reason left in this file: `why` is a
 * required frontmatter field, so this is unreachable for a well-formed
 * content set and its appearance in the UI means content is broken. Any
 * queue position that renders it also fires `onMissingWhy`.
 */
export const FALLBACK_LESSON_REASON = "Next in your track.";

function reasonForLesson(lesson: TrackLesson, onMissingWhy?: (slug: string) => void): string {
  const why = lesson.why?.trim();
  if (why) return why;
  onMissingWhy?.(lesson.slug);
  return FALLBACK_LESSON_REASON;
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
  return {
    kind: "lesson",
    ref: lesson.slug,
    title: lesson.title,
    reason,
    pillar: pillarLabel(lesson.domainId),
    minutes: lesson.minutes,
    status: "ready",
  };
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
  pillar: "Linux",
  minutes: null,
  status: "available-when-runnable",
};

function drillStep(reason: string): TrackStep {
  return {
    kind: "drill",
    ref: "daily",
    title: "Daily drill",
    reason,
    pillar: "Recall",
    minutes: null,
    status: "ready",
  };
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
        pillar: "Networking",
        minutes: null,
        status: "ready",
      },
      {
        kind: "quiz",
        ref: "networking",
        title: "Networking quiz",
        reason: "Check what stuck from the networking lessons.",
        pillar: "Networking",
        minutes: null,
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
  const { completed, lessons, dueCardCount, onMissingWhy } = input;
  const isBeginner = levels.foundations === "FOUNDATIONS";

  const incompleteInDomain = (domain: string): TrackLesson[] =>
    lessons.filter((l) => l.domainId === domain && !completed.has(l.slug)).sort(bySortThenLevel);

  // The lesson spine, in track order, tagged with the domain it came from so
  // interleaving can pick a relevant trainer. Each entry carries the lesson's
  // OWN authored reason — never one shared by the loop that queued it.
  const spine: { lesson: TrackLesson; domain: TrackDomain }[] = [];
  const queuedSlugs = new Set<string>();

  const pushLesson = (lesson: TrackLesson, domain: TrackDomain) => {
    if (queuedSlugs.has(lesson.slug)) return;
    queuedSlugs.add(lesson.slug);
    spine.push({ lesson, domain });
  };

  // Rule 1 — Foundations gate. A beginner (or an un-placed user) always gets
  // the Foundations lessons first: nobody hits "harden SSH" before "what is a
  // service".
  if (isBeginner) {
    for (const lesson of incompleteInDomain("foundations")) {
      pushLesson(lesson, "foundations");
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
      pushLesson(lesson, domain);
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
    steps.push(lessonStep(entry.lesson, reasonForLesson(entry.lesson, onMissingWhy)));
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
  // EVERY other domain that has published content — not just the other
  // machine domains, so forensics/scripting/meta surface here too rather than
  // the queue falling straight to the keep-sharp floor. The result is
  // provably non-empty for any valid input.
  if (spine.length === 0) {
    const coveredDomains = new Set<string>(["foundations", ...focusDomains]);
    const expansionDomains = resolveExpansionDomains(lessons, coveredDomains);
    for (const domain of expansionDomains) {
      for (const lesson of incompleteInDomain(domain)) {
        pushStep(lessonStep(lesson, reasonForLesson(lesson, onMissingWhy)));
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
      pillar: "Linux",
      minutes: null,
      status: "ready",
    });
    pushStep({
      kind: "quiz",
      ref: "forensics",
      title: "Forensics practice",
      reason: "Forensics points come early and cheap — keep them fast.",
      pillar: "Forensics",
      minutes: null,
      status: "ready",
    });
    if (linuxLabReady(lessons, completed, levels.linux)) pushStep(LAB_STEP);
  }

  return steps;
}
