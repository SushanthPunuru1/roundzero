import { describe, expect, it } from "vitest";
import { reconcileCards, type ExistingCard } from "./reconcile";
import type { DesiredCard } from "./parse";

function card(overrides: Partial<DesiredCard> = {}): DesiredCard {
  return {
    id: "card.linux.accounts.uid0.cmd",
    skillNodeId: "linux.accounts.uid0",
    type: "COMMAND",
    front: "Linux: find every UID 0 account.",
    back: "awk -F: '$3 == 0 { print $1 }' /etc/passwd",
    ...overrides,
  };
}

function existingFrom(c: DesiredCard, overrides: Partial<ExistingCard> = {}): ExistingCard {
  return { ...c, active: true, ...overrides };
}

describe("reconcileCards", () => {
  it("creates a card when nothing exists yet", () => {
    const c = card();
    const plan = reconcileCards([c], []);

    expect(plan.toCreate).toEqual([c]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toDeactivate).toEqual([]);
    expect(plan.toReactivate).toEqual([]);
    expect(plan.unchanged).toEqual([]);
  });

  it("reports an identical active card as unchanged", () => {
    const c = card();
    const plan = reconcileCards([c], [existingFrom(c)]);

    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.unchanged).toEqual([c]);
  });

  it("flags a card as changed when content differs", () => {
    const c = card();
    const existing = existingFrom(c, { back: "old answer" });
    const plan = reconcileCards([c], [existing]);

    expect(plan.toUpdate).toEqual([c]);
    expect(plan.unchanged).toEqual([]);
  });

  it("deactivates a card dropped from the YAML instead of deleting it", () => {
    const c = card();
    const gone = existingFrom(card({ id: "card.old.gone", front: "old", back: "old" }));
    const plan = reconcileCards([c], [existingFrom(c), gone]);

    expect(plan.toDeactivate).toEqual([gone]);
    expect(plan.unchanged).toEqual([c]);
  });

  it("reactivates a dormant card that reappears in the YAML, refreshing its content", () => {
    const c = card({ back: "updated answer" });
    const dormant = existingFrom(card(), { active: false, back: "old answer" });
    const plan = reconcileCards([c], [dormant]);

    expect(plan.toReactivate).toEqual([c]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.unchanged).toEqual([]);
  });

  it("does not re-deactivate a card that is already inactive and still absent", () => {
    const c = card();
    const otherDormant = existingFrom(card({ id: "card.old.gone" }), { active: false });
    const plan = reconcileCards([c], [existingFrom(c), otherDormant]);

    expect(plan.toDeactivate).toEqual([]);
  });
});
