import { describe, expect, it } from "vitest";

import type { TrackLevel } from "../taxonomy/parse";
import {
  FALLBACK_LESSON_REASON,
  generateTrack,
  linuxLabReady,
  resolveFocusDomains,
  type FocusMachine,
  type TrackDomain,
  type TrackInput,
  type TrackLesson,
} from "./generate";

// --- fixtures -------------------------------------------------------------

// `why` mirrors production content: authored per lesson, so it is distinct
// for every slug. A fixture that shared one string across lessons would hide
// exactly the bug DECISIONS 038 fixed.
function L(slug: string, domainId: string, level: TrackLevel, sortOrder: number): TrackLesson {
  return {
    slug,
    title: `Lesson ${slug}`,
    why: `Why you want ${slug} right now.`,
    domainId,
    level,
    minutes: 6 + (sortOrder % 5),
    sortOrder,
  };
}

// Mirrors today's published set shape: foundations + windows + networking
// lessons, and (deliberately) ZERO linux lessons — the empty-prerequisite
// state the lab gate must be robust to.
const FOUNDATIONS_LESSONS: TrackLesson[] = [
  L("f-os", "foundations", "FOUNDATIONS", 1),
  L("f-users", "foundations", "FOUNDATIONS", 2),
  L("f-services", "foundations", "FOUNDATIONS", 3),
  L("f-ports", "foundations", "FOUNDATIONS", 4),
  L("f-passwords", "foundations", "FOUNDATIONS", 5),
  L("f-hardening", "foundations", "FOUNDATIONS", 6),
];
const WINDOWS_LESSONS: TrackLesson[] = [
  L("w-accounts", "windows", "STANDARD", 1),
  L("w-users", "windows", "STANDARD", 2),
  L("w-server", "windows", "ADVANCED", 9),
];
const NETWORKING_LESSONS: TrackLesson[] = [
  L("n-osi", "networking", "FOUNDATIONS", 1),
  L("n-ports", "networking", "FOUNDATIONS", 2),
  L("n-ios", "networking", "STANDARD", 3),
];
const ALL_LESSONS = [...FOUNDATIONS_LESSONS, ...WINDOWS_LESSONS, ...NETWORKING_LESSONS];

const BEGINNER_LEVELS: Record<TrackDomain, TrackLevel> = {
  foundations: "FOUNDATIONS",
  linux: "FOUNDATIONS",
  windows: "FOUNDATIONS",
  networking: "FOUNDATIONS",
};
const EXPERT_LEVELS: Record<TrackDomain, TrackLevel> = {
  foundations: "ADVANCED",
  linux: "ADVANCED",
  windows: "ADVANCED",
  networking: "ADVANCED",
};

function input(over: Partial<TrackInput> = {}): TrackInput {
  return {
    focus: ["unsure"],
    levels: BEGINNER_LEVELS,
    lessons: ALL_LESSONS,
    completed: new Set(),
    dueCardCount: 0,
    ...over,
  };
}

const slugs = (steps: { kind: string; ref: string }[]) =>
  steps.filter((s) => s.kind === "lesson").map((s) => s.ref);

// --- reasons are per-step, never per-bucket (DECISIONS 038) --------------

describe("step reasons", () => {
  it("gives the first three steps three DISTINCT reason strings", () => {
    // The regression this exists for: Rule 1 pushed every Foundations lesson
    // with one shared literal, so a brand-new user's top three cards carried
    // one identical sentence.
    const steps = generateTrack(input({ focus: ["linux"], levels: BEGINNER_LEVELS }));
    const topThree = steps.slice(0, 3);
    expect(topThree).toHaveLength(3);

    const reasons = topThree.map((s) => s.reason);
    expect(new Set(reasons).size).toBe(3);
    for (const reason of reasons) {
      expect(reason.trim()).not.toBe("");
    }
  });

  it("uses each lesson's authored `why` verbatim as its reason", () => {
    const steps = generateTrack(input({ focus: ["linux"], levels: BEGINNER_LEVELS }));
    const lessonSteps = steps.filter((s) => s.kind === "lesson");
    const whyBySlug = new Map(ALL_LESSONS.map((l) => [l.slug, l.why]));
    for (const step of lessonSteps) {
      expect(step.reason).toBe(whyBySlug.get(step.ref));
    }
  });

  it("never gives two different lessons the same reason", () => {
    // Scoped to lessons on purpose: a practice step (drill, trainer) is ONE
    // step that recurs by design as Rule 3 interleaves it, so its reason
    // repeating in the queue is correct. Two distinct lessons sharing a
    // sentence is the actual bug.
    for (const focus of [["unsure"], ["linux"], ["windows"], ["cisco"]] as FocusMachine[][]) {
      const steps = generateTrack(input({ focus, dueCardCount: 3 }));
      const byReason = new Map<string, string>();
      for (const step of steps.filter((s) => s.kind === "lesson")) {
        const clash = byReason.get(step.reason);
        expect(
          clash === undefined || clash === step.ref,
          `lessons "${clash}" and "${step.ref}" share the reason "${step.reason}"`,
        ).toBe(true);
        byReason.set(step.reason, step.ref);
      }
    }
  });

  it("never repeats a reason on two ADJACENT steps", () => {
    // Two cards in a row saying the same thing is the visible symptom users
    // reported, regardless of which rule produced them.
    for (const focus of [["unsure"], ["linux"], ["windows"], ["cisco"]] as FocusMachine[][]) {
      const steps = generateTrack(input({ focus, dueCardCount: 3 }));
      for (let i = 1; i < steps.length; i += 1) {
        expect(steps[i]!.reason).not.toBe(steps[i - 1]!.reason);
      }
    }
  });

  it("fires onMissingWhy ZERO times for a fully-populated track", () => {
    const missing: string[] = [];
    // Every focus / level / completion combination, so no code path that
    // queues a lesson can quietly reach the fallback.
    const focuses: FocusMachine[][] = [["unsure"], ["linux"], ["windows"], ["cisco"], ["windows", "cisco"], []];
    for (const focus of focuses) {
      for (const levels of [null, BEGINNER_LEVELS, EXPERT_LEVELS]) {
        for (const completed of [new Set<string>(), new Set(["f-os", "f-users"])]) {
          const steps = generateTrack(
            input({ focus, levels, completed, dueCardCount: 2, onMissingWhy: (slug) => missing.push(slug) }),
          );
          expect(steps.every((s) => s.reason !== FALLBACK_LESSON_REASON)).toBe(true);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("falls back AND reports when a lesson genuinely has no authored why", () => {
    const missing: string[] = [];
    const noWhy: TrackLesson[] = [
      { slug: "orphan", title: "Orphan", domainId: "foundations", level: "FOUNDATIONS", minutes: 5, sortOrder: 1 },
    ];
    const steps = generateTrack(
      input({ lessons: noWhy, focus: ["linux"], onMissingWhy: (slug) => missing.push(slug) }),
    );
    expect(steps[0]!.reason).toBe(FALLBACK_LESSON_REASON);
    expect(missing).toEqual(["orphan"]);
  });

  it("treats a blank/whitespace why as missing rather than rendering an empty line", () => {
    const missing: string[] = [];
    const blank: TrackLesson[] = [
      { slug: "blank", title: "Blank", why: "   ", domainId: "foundations", level: "FOUNDATIONS", minutes: 5, sortOrder: 1 },
    ];
    const steps = generateTrack(
      input({ lessons: blank, focus: ["linux"], onMissingWhy: (slug) => missing.push(slug) }),
    );
    expect(steps[0]!.reason).toBe(FALLBACK_LESSON_REASON);
    expect(missing).toEqual(["blank"]);
  });
});

// --- every step carries pillar + honest cost ------------------------------

describe("step presentation fields", () => {
  it("gives every step a non-empty pillar label", () => {
    const steps = generateTrack(input({ focus: ["unsure"], dueCardCount: 4 }));
    for (const step of steps) {
      expect(step.pillar.trim()).not.toBe("");
    }
  });

  it("carries the lesson's authored minutes, and null where a cost would be invented", () => {
    const steps = generateTrack(input({ focus: ["cisco"], dueCardCount: 4 }));
    const lesson = steps.find((s) => s.kind === "lesson")!;
    const bySlug = new Map(ALL_LESSONS.map((l) => [l.slug, l.minutes]));
    expect(lesson.minutes).toBe(bySlug.get(lesson.ref));

    for (const step of steps.filter((s) => s.kind !== "lesson")) {
      expect(step.minutes).toBeNull();
    }
  });
});

// --- Rule 1: Foundations gate --------------------------------------------

describe("Rule 1 — Foundations gate", () => {
  it("a beginner with no progress gets Foundations lessons first, in sortOrder", () => {
    const steps = generateTrack(input({ focus: ["linux"] }));
    const firstSix = slugs(steps).slice(0, 6);
    expect(firstSix).toEqual(["f-os", "f-users", "f-services", "f-ports", "f-passwords", "f-hardening"]);
  });

  it("puts every Foundations lesson ahead of any machine lesson", () => {
    const steps = generateTrack(input({ focus: ["windows"] }));
    const lessonSlugs = slugs(steps);
    const lastFoundations = Math.max(...FOUNDATIONS_LESSONS.map((l) => lessonSlugs.indexOf(l.slug)));
    const firstWindows = Math.min(
      ...WINDOWS_LESSONS.map((l) => lessonSlugs.indexOf(l.slug)).filter((i) => i >= 0),
    );
    expect(lastFoundations).toBeLessThan(firstWindows);
  });

  it("an expert (foundations >= STANDARD) never sees Foundations lessons", () => {
    const steps = generateTrack(input({ levels: EXPERT_LEVELS, focus: ["windows"], completed: new Set() }));
    for (const lesson of FOUNDATIONS_LESSONS) {
      expect(slugs(steps)).not.toContain(lesson.slug);
    }
  });

  it("treats null placement as a beginner and still leads with Foundations", () => {
    const steps = generateTrack(input({ levels: null }));
    expect(slugs(steps)[0]).toBe("f-os");
  });
});

// --- Rule 2: focus machine + level window --------------------------------

describe("Rule 2 — focus machine lessons, level >= placement", () => {
  it("cisco focus maps to the networking domain", () => {
    const steps = generateTrack(input({ levels: EXPERT_LEVELS, focus: ["cisco"] }));
    // expert → no foundations; advanced networking placement → only ADVANCED
    // networking lessons (none here) so it falls through to expansion, but no
    // windows/linux focus lessons should appear as a *focus* pick.
    const nonExpansion = generateTrack(input({ levels: BEGINNER_LEVELS, focus: ["cisco"] }));
    // beginner cisco: foundations first, then all networking lessons
    expect(slugs(nonExpansion)).toContain("n-osi");
    expect(slugs(nonExpansion)).toContain("n-ios");
    expect(steps.length).toBeGreaterThan(0);
  });

  it("a single-machine focus queues only that machine's lessons", () => {
    // foundations expert (skip the gate), windows at STANDARD so w-accounts is
    // in-window.
    const steps = generateTrack(
      input({ levels: { ...EXPERT_LEVELS, windows: "STANDARD" }, focus: ["windows"] }),
    );
    expect(slugs(steps)).toContain("w-accounts");
    expect(slugs(steps)).not.toContain("n-osi");
  });

  it("excludes lessons below the placement level (level window)", () => {
    // A domain with one lesson per tier; placement STANDARD must drop the
    // FOUNDATIONS lesson and keep STANDARD + ADVANCED, in (level, sortOrder).
    const linuxTiered = [
      L("lx-found", "linux", "FOUNDATIONS", 1),
      L("lx-std", "linux", "STANDARD", 2),
      L("lx-adv", "linux", "ADVANCED", 3),
    ];
    const steps = generateTrack(
      input({
        levels: { ...BEGINNER_LEVELS, foundations: "STANDARD", linux: "STANDARD" },
        focus: ["linux"],
        lessons: linuxTiered,
      }),
    );
    expect(slugs(steps)).toEqual(["lx-std", "lx-adv"]);
  });

  it("unsure/empty focus expands to all machines in Linux→Windows→Networking order", () => {
    expect(resolveFocusDomains(["unsure"])).toEqual(["linux", "windows", "networking"]);
    expect(resolveFocusDomains([])).toEqual(["linux", "windows", "networking"]);
    expect(resolveFocusDomains(["windows"])).toEqual(["windows"]);
    expect(resolveFocusDomains(["cisco", "linux"])).toEqual(["linux", "networking"]);
  });
});

// --- Rule 3: interleave practice -----------------------------------------

describe("Rule 3 — interleave practice after ~2 lessons", () => {
  it("inserts a drill after the first 2 lessons when cards are due", () => {
    const steps = generateTrack(input({ focus: ["windows"], dueCardCount: 4 }));
    // steps[0], steps[1] lessons, steps[2] should be the drill
    expect(steps[2]).toMatchObject({ kind: "drill", ref: "daily" });
  });

  it("does not insert a drill when no cards are due", () => {
    const steps = generateTrack(input({ focus: ["windows"], dueCardCount: 0 }));
    expect(steps.every((s) => s.kind !== "drill" || slugs(steps).length === 0)).toBe(true);
    // no drill among the first several steps
    expect(steps.slice(0, 4).some((s) => s.kind === "drill")).toBe(false);
  });

  it("interleaves the subnetting/networking trainer after networking lessons", () => {
    const steps = generateTrack(
      input({ levels: EXPERT_LEVELS, focus: ["cisco"], lessons: NETWORKING_LESSONS, dueCardCount: 0 }),
    );
    // expert placement networking ADVANCED excludes the FOUNDATIONS/STANDARD
    // networking lessons — so use a beginner to actually get networking lessons
    const beginnerNet = generateTrack(
      input({ focus: ["cisco"], lessons: NETWORKING_LESSONS, dueCardCount: 0 }),
    );
    const kinds = beginnerNet.map((s) => s.kind);
    expect(kinds).toContain("subnetting");
    expect(kinds).toContain("quiz");
    expect(steps.length).toBeGreaterThan(0);
  });

  it("never emits two identical practice steps back to back", () => {
    const steps = generateTrack(input({ focus: ["cisco"], dueCardCount: 3 }));
    for (let i = 1; i < steps.length; i += 1) {
      const same = steps[i]!.kind === steps[i - 1]!.kind && steps[i]!.ref === steps[i - 1]!.ref;
      expect(same).toBe(false);
    }
  });
});

// --- Rule 4: the lab gate ------------------------------------------------

describe("Rule 4 — lab gate, robust to an empty prerequisite set", () => {
  it("does NOT surface the lab for a cold beginner when no Linux lessons exist", () => {
    const steps = generateTrack(input({ focus: ["linux"], levels: BEGINNER_LEVELS }));
    expect(steps.some((s) => s.kind === "lab")).toBe(false);
  });

  it("surfaces the lab once a beginner has completed all Foundations lessons", () => {
    const completed = new Set(FOUNDATIONS_LESSONS.map((l) => l.slug));
    const steps = generateTrack(input({ focus: ["linux"], levels: BEGINNER_LEVELS, completed }));
    expect(steps.some((s) => s.kind === "lab")).toBe(true);
  });

  it("surfaces the lab for a user with demonstrated Linux ability (placement >= STANDARD)", () => {
    const steps = generateTrack(
      input({ focus: ["linux"], levels: { ...EXPERT_LEVELS, linux: "STANDARD" }, completed: new Set() }),
    );
    expect(steps.some((s) => s.kind === "lab")).toBe(true);
  });

  it("prefers real Linux lessons over the proxy once they exist", () => {
    const linuxLessons = [L("lx-1", "linux", "STANDARD", 1), L("lx-2", "linux", "STANDARD", 2)];
    const lessons = [...FOUNDATIONS_LESSONS, ...linuxLessons];
    // Foundations all done + linux placement ADVANCED would satisfy the proxy,
    // but real incomplete Linux lessons exist → gate must NOT open yet.
    const completedFoundations = new Set(FOUNDATIONS_LESSONS.map((l) => l.slug));
    const notReady = generateTrack(
      input({ focus: ["linux"], levels: EXPERT_LEVELS, lessons, completed: completedFoundations }),
    );
    expect(notReady.some((s) => s.kind === "lab")).toBe(false);

    const completedAll = new Set([...completedFoundations, "lx-1", "lx-2"]);
    const ready = generateTrack(
      input({ focus: ["linux"], levels: EXPERT_LEVELS, lessons, completed: completedAll }),
    );
    expect(ready.some((s) => s.kind === "lab")).toBe(true);
  });

  it("marks the lab step available-when-runnable, never a plain ready link", () => {
    const completed = new Set(FOUNDATIONS_LESSONS.map((l) => l.slug));
    const steps = generateTrack(input({ focus: ["linux"], completed }));
    const lab = steps.find((s) => s.kind === "lab")!;
    expect(lab.status).toBe("available-when-runnable");
  });

  it("linuxLabReady unit: empty-prereq proxy behaviour", () => {
    expect(linuxLabReady([], new Set(), "FOUNDATIONS")).toBe(false);
    expect(linuxLabReady([], new Set(), "STANDARD")).toBe(true);
    expect(linuxLabReady(FOUNDATIONS_LESSONS, new Set(), "FOUNDATIONS")).toBe(false);
    expect(
      linuxLabReady(FOUNDATIONS_LESSONS, new Set(FOUNDATIONS_LESSONS.map((l) => l.slug)), "FOUNDATIONS"),
    ).toBe(true);
  });
});

// --- completing steps advances the queue ---------------------------------

describe("completing steps advances the queue", () => {
  it("moves the top lesson forward as the user completes lessons", () => {
    const base = input({ focus: ["linux"] });
    expect(slugs(generateTrack(base))[0]).toBe("f-os");

    const after1 = generateTrack({ ...base, completed: new Set(["f-os"]) });
    expect(slugs(after1)[0]).toBe("f-users");

    const after2 = generateTrack({ ...base, completed: new Set(["f-os", "f-users"]) });
    expect(slugs(after2)[0]).toBe("f-services");
  });
});

// --- Rule 5: never empty -------------------------------------------------

describe("Rule 5 — never returns an empty track for any valid state", () => {
  const focuses: FocusMachine[][] = [["unsure"], ["linux"], ["windows"], ["cisco"], ["windows", "cisco"], []];
  const levelSets = [null, BEGINNER_LEVELS, EXPERT_LEVELS];
  const completions = [new Set<string>(), new Set(ALL_LESSONS.map((l) => l.slug))];

  for (const focus of focuses) {
    for (const levels of levelSets) {
      for (const completed of completions) {
        it(`focus=${JSON.stringify(focus)} levels=${levels ? "set" : "null"} completed=${completed.size}`, () => {
          const steps = generateTrack(input({ focus, levels, completed, dueCardCount: 0 }));
          expect(steps.length).toBeGreaterThan(0);
        });
      }
    }
  }

  it("a fully-complete expert still gets a keep-sharp floor (drill + checklist), not a dead end", () => {
    const steps = generateTrack(
      input({
        levels: EXPERT_LEVELS,
        focus: ["linux"],
        completed: new Set(ALL_LESSONS.map((l) => l.slug)),
      }),
    );
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some((s) => s.kind === "drill")).toBe(true);
    expect(steps.some((s) => s.kind === "checklist")).toBe(true);
  });

  it("expands into other machines when the focus track is exhausted", () => {
    // expert, focus linux (no linux lessons), all foundations done →
    // spine empty → expansion should surface windows + networking lessons.
    const completed = new Set(FOUNDATIONS_LESSONS.map((l) => l.slug));
    const steps = generateTrack(input({ levels: EXPERT_LEVELS, focus: ["linux"], completed }));
    const lessonSlugs = slugs(steps);
    expect(lessonSlugs).toContain("w-accounts");
    expect(lessonSlugs).toContain("n-osi");
  });
});
