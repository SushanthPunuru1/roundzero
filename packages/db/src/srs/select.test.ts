import { describe, expect, it } from "vitest";
import { dueCards, selectNewFoundationsCards } from "./select";

describe("dueCards", () => {
  const now = new Date("2026-07-18T12:00:00Z");

  it("selects only states whose due is now or in the past", () => {
    const states = [
      { cardId: "a", due: new Date("2026-07-18T11:00:00Z") }, // due
      { cardId: "b", due: new Date("2026-07-18T13:00:00Z") }, // not due
      { cardId: "c", due: now }, // due exactly now
    ];

    expect(dueCards(states, now).map((s) => s.cardId)).toEqual(["a", "c"]);
  });

  it("sorts due states earliest-due first", () => {
    const states = [
      { cardId: "later", due: new Date("2026-07-18T09:00:00Z") },
      { cardId: "earliest", due: new Date("2026-07-18T06:00:00Z") },
      { cardId: "middle", due: new Date("2026-07-18T08:00:00Z") },
    ];

    expect(dueCards(states, now).map((s) => s.cardId)).toEqual([
      "earliest",
      "middle",
      "later",
    ]);
  });

  it("returns an empty array when nothing is due", () => {
    const states = [{ cardId: "a", due: new Date("2026-07-19T00:00:00Z") }];
    expect(dueCards(states, now)).toEqual([]);
  });
});

describe("selectNewFoundationsCards", () => {
  const allCards = [
    { id: "card.foundations.core.b", skillNodeId: "foundations.core.services" },
    { id: "card.foundations.core.a", skillNodeId: "foundations.core.os-basics" },
    { id: "card.foundations.competition.x", skillNodeId: "foundations.competition.readme" },
    { id: "card.linux.accounts.uid0", skillNodeId: "linux.accounts.uid0" },
  ];

  it("only picks Foundations-domain cards", () => {
    const picked = selectNewFoundationsCards(allCards, new Set(), 0, 10);
    expect(picked).toEqual([
      "card.foundations.competition.x",
      "card.foundations.core.a",
      "card.foundations.core.b",
    ]);
  });

  it("excludes cards already in rotation for the user", () => {
    const picked = selectNewFoundationsCards(
      allCards,
      new Set(["card.foundations.core.a"]),
      0,
      10,
    );
    expect(picked).toEqual(["card.foundations.competition.x", "card.foundations.core.b"]);
  });

  it("respects cap minus already-introduced-today", () => {
    const picked = selectNewFoundationsCards(allCards, new Set(), 2, 3);
    expect(picked).toHaveLength(1);
    expect(picked).toEqual(["card.foundations.competition.x"]);
  });

  it("returns nothing once the daily cap is already met", () => {
    const picked = selectNewFoundationsCards(allCards, new Set(), 10, 10);
    expect(picked).toEqual([]);
  });

  it("returns nothing when introducedToday exceeds the cap", () => {
    const picked = selectNewFoundationsCards(allCards, new Set(), 15, 10);
    expect(picked).toEqual([]);
  });
});
