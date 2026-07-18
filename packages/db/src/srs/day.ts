// Shared local-calendar-day helpers for the daily drill (streak + new-card
// cap). No per-user timezone is stored (data minimization, CLAUDE.md rule 8)
// — PLATFORM_TIME_ZONE is a fixed constant threaded through as a parameter
// everywhere it's used, so swapping in a per-user timezone later is a config
// change at the call site, never a data migration. See DECISIONS for the
// known edge case and the revisit trigger.

export const PLATFORM_TIME_ZONE = "America/New_York";

export const DAILY_NEW_CARD_CAP = 10;

/** The instant's calendar date ("2026-07-18") in the given IANA timezone. */
export function localDateKey(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
