import { describe, expect, it } from "vitest";
import { newCardState, scheduleReview, Rating, type CardState } from "./schedule";

const NOW = new Date("2026-07-18T00:00:00Z");

describe("newCardState", () => {
  it("returns the fsrs empty-card shape, immediately due", () => {
    const state = newCardState(NOW);

    expect(state.due).toEqual(NOW);
    expect(state.state).toBe(0); // New
    expect(state.reps).toBe(0);
    expect(state.lapses).toBe(0);
    expect(state.stability).toBe(0);
    expect(state.difficulty).toBe(0);
    expect(state.elapsedDays).toBe(0);
    expect(state.scheduledDays).toBe(0);
    expect(state.learningSteps).toBe(0);
    expect(state.lastReview).toBeNull();
  });
});

describe("scheduleReview", () => {
  it("moves reps to 1 and sets lastReview, whatever the rating", () => {
    for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
      const next = scheduleReview(newCardState(NOW), rating, NOW);
      expect(next.reps).toBe(1);
      expect(next.lastReview).toEqual(NOW);
      expect(Number.isNaN(next.stability)).toBe(false);
      expect(Number.isNaN(next.difficulty)).toBe(false);
    }
  });

  it("Again on a fresh card keeps it in the learning phase with a near-term due date", () => {
    const next = scheduleReview(newCardState(NOW), Rating.Again, NOW);
    expect(next.state).not.toBe(2); // not Review yet
    expect(next.lapses).toBe(0); // lapses only counts Review -> Relearning drops
    expect(next.due.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("Easy on a fresh card can graduate straight to Review with a due date days out", () => {
    const next = scheduleReview(newCardState(NOW), Rating.Easy, NOW);
    expect(next.state).toBe(2); // Review
    expect(next.due.getTime() - NOW.getTime()).toBeGreaterThan(24 * 60 * 60 * 1000);
  });

  it("Good pushes the due date further out than Again or Hard", () => {
    const again = scheduleReview(newCardState(NOW), Rating.Again, NOW);
    const hard = scheduleReview(newCardState(NOW), Rating.Hard, NOW);
    const good = scheduleReview(newCardState(NOW), Rating.Good, NOW);

    expect(good.due.getTime()).toBeGreaterThan(hard.due.getTime());
    expect(hard.due.getTime()).toBeGreaterThan(again.due.getTime());
  });

  it("a second review builds on the first review's returned state (reps accumulate)", () => {
    const first = scheduleReview(newCardState(NOW), Rating.Good, NOW);
    const secondNow = new Date(first.due.getTime() + 1000);
    const second = scheduleReview(first, Rating.Good, secondNow);

    expect(second.reps).toBe(2);
    expect(second.due.getTime()).toBeGreaterThan(secondNow.getTime());
  });

  function reachReviewState(): CardState {
    let state = newCardState(NOW);
    for (let i = 0; i < 5; i += 1) {
      const reviewAt = i === 0 ? NOW : new Date(state.due.getTime() + 1000);
      state = scheduleReview(state, Rating.Good, reviewAt);
    }
    return state;
  }

  it("repeated Good ratings graduate the card into the Review state", () => {
    const state = reachReviewState();
    expect(state.state).toBe(2); // Review
    expect(state.reps).toBeGreaterThanOrEqual(2);
  });

  it("Again on a Review-state card records a lapse and drops it to Relearning", () => {
    const state = reachReviewState();
    const lapseNow = new Date(state.due.getTime() + 1000);
    const next = scheduleReview(state, Rating.Again, lapseNow);

    expect(next.lapses).toBe(state.lapses + 1);
    expect(next.state).toBe(3); // Relearning
  });
});
