// Deliberately NOT "use client". The date and the day-count are plain
// functions the server component calls during render; the animated numeral
// that consumes them is the only part that needs the client. Exporting them
// from countdown.tsx put them behind the client boundary, where a server
// component calling daysUntil() is a runtime error rather than a type error
// — which is why `next build` passed and the page still broke.

/**
 * CyberPatriot XIX Round 1: October 22–25, 2026. Confirmed by the author,
 * 2026-10-16, replacing a placeholder of 2026-11-12 that had been inferred
 * from XVIII's November window. The countdown was reading 28 days when the
 * true figure was 6 — the single worst number on the page to be wrong about,
 * because it is the one a competitor checks against what their coach told
 * them.
 *
 * This is the FIRST day of the window. `daysUntil` therefore counts down to
 * the moment the round opens, not to its end.
 */
export const ROUND_ONE = "2026-10-22";

/** Last day of the Round 1 window, inclusive. */
export const ROUND_ONE_END = "2026-10-25";

export type RoundPhase = "before" | "during" | "after";

/**
 * Which side of the Round 1 window we are on.
 *
 * This exists because `daysUntil` floors at zero, so from the morning the
 * round opened the hero read "0 DAYS TO ROUND 1" — a countdown that had
 * arrived and then just sat there. A number that stops meaning anything is
 * worse than no number, because the reader assumes the whole page is stale.
 *
 * Inclusive of both ends: the round is "during" for all four days it runs.
 */
export function roundPhase(now: Date = new Date()): RoundPhase {
  const day = (iso: string) =>
    Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10)),
    );
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  if (today < day(ROUND_ONE)) return "before";
  if (today <= day(ROUND_ONE_END)) return "during";
  return "after";
}

/** Whole days between now and the target, floored at zero. Computed in UTC on
 * both server and client so the two agree — a locale-dependent day count is a
 * hydration mismatch that only shows up for readers in other timezones.
 *
 * ⚠️ The floor means this returns 0 forever once the date has passed, and the
 * hero will read "0 DAYS TO ROUND 1" indefinitely from 2026-10-22 onward.
 * That is a visible bug on a launch page, not a theoretical one — it starts
 * the day the round opens. Fixing it needs a product decision about what the
 * hero says during and after the window, which is why it is flagged here
 * rather than guessed at. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((target - today) / 86_400_000));
}
