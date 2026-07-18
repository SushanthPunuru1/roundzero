// Pure diff of desired (YAML) drill cards against existing (DB) rows. Cards
// are never hard-deleted, even when dropped from the YAML — UserCardState
// and ReviewLog rows reference them and carry a student's review history. A
// dropped card is soft-deactivated (active: false); a card that reappears is
// reactivated. Mirrors SkillNode's deprecate-never-delete pattern (DECISIONS
// 006), not checklist items' hard-delete pattern (DECISIONS 022) — checklist
// items carry no user data, drill cards do.

import type { CardType, DesiredCard } from "./parse";

export interface ExistingCard {
  id: string;
  skillNodeId: string;
  type: CardType;
  front: string;
  back: string;
  active: boolean;
}

export interface CardSyncPlan {
  toCreate: DesiredCard[];
  toUpdate: DesiredCard[];
  toDeactivate: ExistingCard[];
  toReactivate: DesiredCard[];
  unchanged: DesiredCard[];
}

function sameCard(desired: DesiredCard, existing: ExistingCard): boolean {
  return (
    desired.skillNodeId === existing.skillNodeId &&
    desired.type === existing.type &&
    desired.front === existing.front &&
    desired.back === existing.back
  );
}

export function reconcileCards(
  desired: DesiredCard[],
  existing: ExistingCard[],
): CardSyncPlan {
  const existingById = new Map(existing.map((card) => [card.id, card]));
  const desiredIds = new Set(desired.map((card) => card.id));

  const toCreate: DesiredCard[] = [];
  const toUpdate: DesiredCard[] = [];
  const toReactivate: DesiredCard[] = [];
  const unchanged: DesiredCard[] = [];

  for (const card of desired) {
    const current = existingById.get(card.id);
    if (!current) {
      toCreate.push(card);
    } else if (!current.active) {
      // Reactivating always writes the full desired row, since content may
      // have drifted while the card was dormant.
      toReactivate.push(card);
    } else if (sameCard(card, current)) {
      unchanged.push(card);
    } else {
      toUpdate.push(card);
    }
  }

  const toDeactivate = existing.filter((card) => card.active && !desiredIds.has(card.id));

  return { toCreate, toUpdate, toDeactivate, toReactivate, unchanged };
}
