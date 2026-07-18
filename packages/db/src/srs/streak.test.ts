import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";

const TZ = "America/New_York";

// Noon UTC is comfortably inside the same Eastern calendar day regardless of
// EST/EDT, keeping these fixtures simple.
function noonUtc(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}

describe("computeStreak", () => {
  it("is 0 with no reviews", () => {
    expect(computeStreak([], noonUtc("2026-07-18"), TZ)).toBe(0);
  });

  it("counts a single review today as a streak of 1", () => {
    const now = noonUtc("2026-07-18");
    expect(computeStreak([now], now, TZ)).toBe(1);
  });

  it("counts consecutive days ending today", () => {
    const now = noonUtc("2026-07-18");
    const reviews = [noonUtc("2026-07-16"), noonUtc("2026-07-17"), noonUtc("2026-07-18")];
    expect(computeStreak(reviews, now, TZ)).toBe(3);
  });

  it("still counts as current if the most recent review was yesterday", () => {
    const now = noonUtc("2026-07-18");
    const reviews = [noonUtc("2026-07-16"), noonUtc("2026-07-17")];
    expect(computeStreak(reviews, now, TZ)).toBe(2);
  });

  it("breaks the streak when a day is skipped", () => {
    const now = noonUtc("2026-07-18");
    // Reviewed the 15th and 16th, then nothing on the 17th, and nothing today.
    const reviews = [noonUtc("2026-07-15"), noonUtc("2026-07-16")];
    expect(computeStreak(reviews, now, TZ)).toBe(0);
  });

  it("only counts consecutive days up to the first gap, ignoring older activity", () => {
    const now = noonUtc("2026-07-18");
    const reviews = [
      noonUtc("2026-07-10"), // isolated, separated by a gap
      noonUtc("2026-07-17"),
      noonUtc("2026-07-18"),
    ];
    expect(computeStreak(reviews, now, TZ)).toBe(2);
  });

  it("counts a same-day double review once, not twice", () => {
    const now = new Date("2026-07-18T20:00:00Z");
    const reviews = [
      new Date("2026-07-18T13:00:00Z"),
      new Date("2026-07-18T19:59:00Z"),
      noonUtc("2026-07-17"),
    ];
    expect(computeStreak(reviews, now, TZ)).toBe(2);
  });

  it("straddles a UTC midnight without breaking, honoring the given timezone", () => {
    // 2026-07-18 23:30 UTC is still 2026-07-18 19:30 in America/New_York.
    const now = new Date("2026-07-18T23:30:00Z");
    const reviews = [new Date("2026-07-18T23:30:00Z"), noonUtc("2026-07-17")];
    expect(computeStreak(reviews, now, TZ)).toBe(2);
  });
});
