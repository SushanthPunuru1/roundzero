// Deliberately NOT "use client". The date and the day-count are plain
// functions the server component calls during render; the animated numeral
// that consumes them is the only part that needs the client. Exporting them
// from countdown.tsx put them behind the client boundary, where a server
// component calling daysUntil() is a runtime error rather than a type error
// — which is why `next build` passed and the page still broke.

/**
 * ⚠️ INFERRED, NOT OFFICIAL — confirm at uscyberpatriot.org before this page
 * is shown to anyone outside the project.
 *
 * CyberPatriot XIX's Round 1 dates were not published when this was written.
 * XVIII ran Round 1 on November 13–16 2025, a Thursday-to-Sunday window, so
 * this is the equivalent Thursday in 2026 rather than an arbitrary pick.
 * That makes it a reasonable estimate and still not a fact.
 *
 * It matters because this is the one number on the page a competitor will
 * check against what their coach told them: wrong here costs more credibility
 * than every other detail on the page combined.
 */
export const ROUND_ONE = "2026-11-12";

/** Whole days between now and the target, floored at zero. Computed in UTC on
 * both server and client so the two agree — a locale-dependent day count is a
 * hydration mismatch that only shows up for readers in other timezones. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((target - today) / 86_400_000));
}
