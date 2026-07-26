import { describe, expect, it } from "vitest";
import type { TrackStep } from "@roundzero/db";

import { aggregatePillars, hrefForStep, normalizeFocus, normalizeLevels } from "./track";

const step = (over: Partial<TrackStep>): TrackStep => ({
  kind: "lesson",
  ref: "x",
  title: "t",
  reason: "r",
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

  it("always returns the five pillars in canonical order", () => {
    const pillars = aggregatePillars({
      lessons: [],
      completedSlugs: new Set(),
      networkingQuizScores: [],
      subnettingBest: null,
      forensicsScores: [90],
    });
    expect(pillars.map((p) => p.domain)).toEqual(["foundations", "linux", "windows", "networking", "forensics"]);
    expect(pillars.find((p) => p.domain === "forensics")!.detail).toBe("90% quiz avg");
  });
});
