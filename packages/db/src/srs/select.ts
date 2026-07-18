// Pure card-queue selection for the daily drill: which reviews are due right
// now, and which new cards to introduce. No DB access — see
// apps/web/src/lib/drill.ts for the Prisma glue.

export interface DueableState {
  cardId: string;
  due: Date;
}

/** States whose card is due for review right now, earliest due first. */
export function dueCards<T extends DueableState>(states: T[], now: Date): T[] {
  return states
    .filter((state) => state.due.getTime() <= now.getTime())
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}

export interface SelectableCard {
  id: string;
  skillNodeId: string;
}

/**
 * Picks new Foundations-domain cards to introduce today, respecting a daily
 * cap. `inRotationCardIds` is every card the user already has a
 * UserCardState for (any source — a lesson enqueue or a prior day's batch).
 * `introducedToday` is how many new UserCardState rows were already created
 * for this user today. Deterministic order (by card id) so re-running
 * mid-session never reshuffles the batch.
 */
export function selectNewFoundationsCards(
  allCards: SelectableCard[],
  inRotationCardIds: Set<string>,
  introducedToday: number,
  cap: number,
): string[] {
  const remaining = Math.max(0, cap - introducedToday);
  if (remaining === 0) return [];

  return allCards
    .filter((card) => card.skillNodeId.startsWith("foundations."))
    .filter((card) => !inRotationCardIds.has(card.id))
    .map((card) => card.id)
    .sort()
    .slice(0, remaining);
}
