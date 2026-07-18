// Pure streak calculation over raw ReviewLog timestamps. Always derived at
// read time from the review instants passed in — never a stored/cached
// counter — so swapping PLATFORM_TIME_ZONE for a per-user timezone later is
// a config change at the call site, not a data migration. See DECISIONS for
// the known edge case (a west-coast student straddling the fixed Eastern-
// time day boundary) and the revisit trigger.

import { localDateKey } from "./day";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Calendar-date arithmetic happens entirely in this synthetic UTC-midnight
// space — never on real instants — so it's immune to DST regardless of
// timeZone. `key` is always a plain "YYYY-MM-DD" produced by localDateKey.
function keyToUtcMidnight(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!);
}

function utcMidnightToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Counts consecutive local calendar days with at least one review, walking
 * backward from today. The streak must include today or yesterday to count
 * as current — anything older with a gap since is 0. Multiple reviews on the
 * same local day count once (same-day double review doesn't inflate it).
 */
export function computeStreak(reviewInstants: Date[], now: Date, timeZone: string): number {
  const dayKeys = new Set(reviewInstants.map((instant) => localDateKey(instant, timeZone)));
  if (dayKeys.size === 0) return 0;

  let cursor = keyToUtcMidnight(localDateKey(now, timeZone));

  if (!dayKeys.has(utcMidnightToKey(cursor))) {
    cursor -= MS_PER_DAY;
    if (!dayKeys.has(utcMidnightToKey(cursor))) {
      return 0;
    }
  }

  let streak = 0;
  while (dayKeys.has(utcMidnightToKey(cursor))) {
    streak += 1;
    cursor -= MS_PER_DAY;
  }
  return streak;
}
