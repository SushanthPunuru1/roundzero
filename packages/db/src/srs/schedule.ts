// Thin, unit-tested wrapper around ts-fsrs (DECISIONS 005) — the scheduling
// math itself is never hand-rolled here. This module's whole job is mapping
// between ts-fsrs's snake_case Card shape and UserCardState's camelCase
// columns, so nothing outside packages/db needs to import ts-fsrs directly.

import { createEmptyCard, fsrs, type Card as FsrsCard, type Grade } from "ts-fsrs";

export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type Rating = (typeof Rating)[keyof typeof Rating];

/** Mirrors UserCardState's fsrs-derived columns (packages/db/prisma/schema.prisma). */
export interface CardState {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number; // fsrs State: 0 New 1 Learning 2 Review 3 Relearning
  lastReview: Date | null;
}

const scheduler = fsrs();

function toFsrsCard(state: CardState): FsrsCard {
  return {
    due: state.due,
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.lastReview ?? undefined,
  } as FsrsCard;
}

function fromFsrsCard(card: FsrsCard): CardState {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ?? null,
  };
}

/** The state a brand-new UserCardState row starts with (fsrs createEmptyCard). */
export function newCardState(now: Date): CardState {
  return fromFsrsCard(createEmptyCard(now));
}

/** Applies a review rating to a card's state via ts-fsrs, returning the next
 * state. Never hand-rolls the scheduling math — ts-fsrs owns it. */
export function scheduleReview(state: CardState, rating: Rating, now: Date): CardState {
  const { card } = scheduler.next(toFsrsCard(state), now, rating as Grade);
  return fromFsrsCard(card);
}
