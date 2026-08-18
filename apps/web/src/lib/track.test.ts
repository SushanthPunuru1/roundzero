import { describe, expect, it } from "vitest";
import type { TrackStep } from "@roundzero/db";

import {
  aggregatePillars,
  hrefForStep,
  normalizeFocus,
  normalizeLevels,
  totalProgress,
} from "./track";

const step = (over: Partial<TrackStep>): TrackStep => ({
  kind: "lesson",
  ref: "x",
  title: "t",
  reason: "r",
  pillar: "Foundations",
  minutes: 7,
  status: "ready",
  ...over,
});

describe("normalizeFocus", () => {
  it("keeps valid focus machines", () => {
    expect(normalizeFocus(["linux", "windows"])).toEqual(["linux", "windows"]);
  });
  it("drops unknown values", () => {
    expect(normalizeFocus(["linux", "nonsense", 3])).toEqual(["linux"]);
  });
  it("falls back to ['unsure'] on empty/garbage", () => {
    expect(normalizeFocus([])).toEqual(["unsure"]);
    expect(normalizeFocus(null)).toEqual(["unsure"]);
    expect(normalizeFocus("linux")).toEqual(["unsure"]);
  });
});

describe("normalizeLevels", () => {
  it("fills all four domains, defaulting missing/invalid to FOUNDATIONS", () => {
    expect(normalizeLevels({ linux: "ADVANCED", windows: "bogus" })).toEqual({
      foundations: "FOUNDATIONS",
      linux: "ADVANCED",
      windows: "FOUNDATIONS",
      networking: "FOUNDATIONS",
    });
  });
  it("handles a non-object", () => {
    expect(normalizeLevels(null).foundations).toBe("FOUNDATIONS");
  });
});

describe("hrefForStep", () => {
  it("routes each kind", () => {
    expect(hrefForStep(step({ kind: "lesson", ref: "what-is-an-os" }))).toBe("/app/lessons/what-is-an-os");
    expect(hrefForStep(step({ kind: "drill", ref: "daily" }))).toBe("/app/drill");
    expect(hrefForStep(step({ kind: "subnetting", ref: "subnetting" }))).toBe("/app/subnetting");
    expect(hrefForStep(step({ kind: "checklist", ref: "linux-core" }))).toBe("/app/checklists/linux-core");
    expect(hrefForStep(step({ kind: "lab", ref: "linux-practice" }))).toBe("/app/lab");
    expect(hrefForStep(step({ kind: "quiz", ref: "networking" }))).toBe("/app/networking");
    expect(hrefForStep(step({ kind: "quiz", ref: "forensics" }))).toBe("/app/forensics");
    expect(hrefForStep(step({ kind: "quiz", ref: "networking:ports" }))).toBe("/app/networking/ports");
  });
});

describe("aggregatePillars", () => {
  it("counts lessons per pillar and reports honest quiz detail", () => {
    const pillars = aggregatePillars({
      lessons: [
        { domainId: "foundations", slug: "f1" },
        { domainId: "foundations", slug: "f2" },
        { domainId: "networking", slug: "n1" },
      ],
      completedSlugs: new Set(["f1"]),
      networkingQuizScores: [60, 80],
      subnettingBest: 100,
      forensicsScores: [],
    });
    const foundations = pillars.find((p) => p.domain === "foundations")!;
    expect(foundations).toMatchObject({ lessonsDone: 1, lessonsTotal: 2, detail: null });

    const networking = pillars.find((p) => p.domain === "networking")!;
    expect(networking.lessonsDone).toBe(0);
    expect(networking.detail).toBe("70% quiz avg · subnetting best 100%");

    const forensics = pillars.find((p) => p.domain === "forensics")!;
    expect(forensics).toMatchObject({ lessonsTotal: 0, detail: null });
  });

  it("always returns all seven pillars, including scripting and meta, in canonical order", () => {
    const pillars = aggregatePillars({
      lessons: [],
      completedSlugs: new Set(),
      networkingQuizScores: [],
      subnettingBest: null,
      forensicsScores: [90],
    });
    expect(pillars.map((p) => p.domain)).toEqual([
      "foundations",
      "linux",
      "windows",
      "networking",
      "forensics",
      "scripting",
      "meta",
    ]);
    expect(pillars.find((p) => p.domain === "forensics")!.detail).toBe("90% quiz avg");
  });

  // avg() used to return Math.round(0/0) === NaN on an empty array. Both call
  // sites guarded it, so this never shipped a "NaN% quiz avg" — but the guard
  // now lives in avg() itself rather than in every caller.
  it("never renders NaN when a pillar has no scores at all", () => {
    const pillars = aggregatePillars({
      lessons: [],
      completedSlugs: new Set(),
      networkingQuizScores: [],
      subnettingBest: null,
      forensicsScores: [],
    });
    for (const pillar of pillars) {
      expect(pillar.detail ?? "").not.toContain("NaN");
    }
    expect(pillars.find((p) => p.domain === "networking")!.detail).toBeNull();
    expect(pillars.find((p) => p.domain === "forensics")!.detail).toBeNull();
  });
});

describe("totalProgress", () => {
  it("sums lessons across every pillar", () => {
    const pillars = aggregatePillars({
      lessons: [
        { domainId: "foundations", slug: "f1" },
        { domainId: "foundations", slug: "f2" },
        { domainId: "windows", slug: "w1" },
        { domainId: "networking", slug: "n1" },
      ],
      completedSlugs: new Set(["f1", "n1"]),
      networkingQuizScores: [],
      subnettingBest: null,
      forensicsScores: [],
    });
    expect(totalProgress(pillars)).toEqual({ done: 2, total: 4 });
  });

  it("is zero/zero rather than NaN for an empty content set", () => {
    expect(totalProgress([])).toEqual({ done: 0, total: 0 });
  });

  // The bug this guards against: PILLAR_ORDER used to omit scripting/meta, so
  // their lessons were counted into totalByDomain by aggregatePillars but then
  // never surfaced (PILLAR_ORDER.map only walked the five it knew about) —
  // "Where you stand" undercounted the total ("of 44" instead of "of 53").
  it("counts scripting and meta lessons into the total, not just the five original pillars", () => {
    const pillars = aggregatePillars({
      lessons: [
        { domainId: "scripting", slug: "s1" },
        { domainId: "scripting", slug: "s2" },
        { domainId: "meta", slug: "m1" },
      ],
      completedSlugs: new Set(["s1"]),
      networkingQuizScores: [],
      subnettingBest: null,
      forensicsScores: [],
    });
    expect(totalProgress(pillars)).toEqual({ done: 1, total: 3 });
  });
});
