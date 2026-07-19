import { describe, expect, it } from "vitest";

import { ScoreParseError, shapeReport } from "./score";

// Fixtures mirror the real shape agent/internal/report.Report.JSON() emits
// (see agent/internal/report/report.go) — captured field-for-field, not
// guessed.
const FRESH_VULNERABLE = JSON.stringify({
  generatedAt: "2026-07-19T00:00:00Z",
  totalPossible: 100,
  totalEarned: 0,
  checks: [
    {
      id: "uid0-backdoor",
      title: "No unauthorized UID 0 accounts",
      skillNode: "linux.accounts.uid0",
      points: 12,
      earned: 0,
      pass: false,
      detail: "found UID 0 account: backdoor",
      timestamp: "2026-07-19T00:00:00Z",
    },
    {
      id: "decoy-authorized-user",
      title: "Authorized user zzsync is present (do not remove)",
      skillNode: "linux.accounts.passwd-shadow",
      points: 0,
      earned: 0,
      pass: true,
      detail: "user zzsync present",
      timestamp: "2026-07-19T00:00:00Z",
    },
  ],
});

const HALF_FIXED_WITH_ERROR = JSON.stringify({
  generatedAt: "2026-07-19T00:05:00Z",
  totalPossible: 88,
  totalEarned: 48,
  checks: [
    {
      id: "uid0-backdoor",
      title: "No unauthorized UID 0 accounts",
      skillNode: "linux.accounts.uid0",
      points: 12,
      earned: 12,
      pass: true,
      detail: "no UID 0 account named backdoor",
      timestamp: "2026-07-19T00:05:00Z",
    },
    {
      id: "broken-check",
      title: "Some check that failed to evaluate",
      skillNode: "linux.updates-network.ufw",
      points: 10,
      earned: 0,
      pass: false,
      detail: "",
      error: "command exited 127",
      timestamp: "2026-07-19T00:05:00Z",
    },
  ],
});

describe("shapeReport", () => {
  it("shapes a fresh-vulnerable report (0 earned, mixed pass/fail)", () => {
    const report = shapeReport(FRESH_VULNERABLE);
    expect(report.totalEarned).toBe(0);
    expect(report.totalPossible).toBe(100);
    expect(report.checks).toHaveLength(2);
    expect(report.checks[0]).toMatchObject({ id: "uid0-backdoor", pass: false, earned: 0 });
    expect(report.checks[1]).toMatchObject({ id: "decoy-authorized-user", pass: true, points: 0 });
  });

  it("shapes a partially-fixed report and preserves a per-check error", () => {
    const report = shapeReport(HALF_FIXED_WITH_ERROR);
    expect(report.totalEarned).toBe(48);
    expect(report.checks[1]?.error).toBe("command exited 127");
    expect(report.checks[0]?.error).toBeUndefined();
  });

  it("throws ScoreParseError on invalid JSON", () => {
    expect(() => shapeReport("not json")).toThrow(ScoreParseError);
  });

  it("throws ScoreParseError when a required field is missing", () => {
    const bad = JSON.stringify({ generatedAt: "x", totalPossible: 1, checks: [] });
    expect(() => shapeReport(bad)).toThrow(ScoreParseError);
  });

  it("throws ScoreParseError when a check line is malformed", () => {
    const bad = JSON.stringify({
      generatedAt: "x",
      totalPossible: 1,
      totalEarned: 0,
      checks: [{ id: "only-an-id" }],
    });
    expect(() => shapeReport(bad)).toThrow(ScoreParseError);
  });
});
