// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, act, fireEvent, render, screen } from "@testing-library/react";

import { DrillSession } from "./drill-session";
import type { DrillCardView } from "@/lib/drill";

// The bug this guards against: rating a card calls the rateCard server
// action, which revalidates the /app/drill route. Next.js then re-renders
// the parent Server Component and passes a freshly re-fetched (shrinking)
// `queue` prop into this already-mounted client component. If the session
// re-reads its position from that live prop instead of a frozen snapshot of
// the batch it started with, cards get silently skipped and "all caught up"
// can render while cards are still genuinely due — see the bug report.
vi.mock("./actions", () => ({
  rateCard: vi.fn(async () => ({})),
}));

afterEach(cleanup);

function card(id: string, front: string): DrillCardView {
  return { stateId: id, cardId: id, type: "CONCEPT", front, back: `${front} — answer` };
}

describe("DrillSession", () => {
  it("keeps working through its original batch — not a live re-fetched queue — after a mid-session re-render", async () => {
    const initial = [card("a", "Card A"), card("b", "Card B"), card("c", "Card C")];

    const { rerender } = render(<DrillSession queue={initial} />);

    screen.getByText("Card 1 of 3");
    screen.getByText("Card A");

    // Reveal, then rate "a" as Good.
    fireEvent.keyDown(window, { key: " " });
    await act(async () => {
      fireEvent.keyDown(window, { key: "3" });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Simulate the automatic route refresh that follows a server action:
    // the parent re-renders with a freshly re-fetched due queue that has
    // already dropped "a" (its due date moved forward).
    rerender(<DrillSession queue={[card("b", "Card B"), card("c", "Card C")]} />);

    // The session must still be on card "b" — not skip ahead, and not
    // declare victory just because the live server queue shrank.
    expect(screen.queryByText(/All caught up/i)).toBeNull();
    screen.getByText("Card 2 of 3");
    screen.getByText("Card B");
  });

  it("only shows the caught-up state once every card in the original batch has been rated", async () => {
    const initial = [card("a", "Card A"), card("b", "Card B")];
    render(<DrillSession queue={initial} />);

    for (const label of ["Card A", "Card B"]) {
      screen.getByText(label);
      fireEvent.keyDown(window, { key: " " });
      await act(async () => {
        fireEvent.keyDown(window, { key: "3" });
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    screen.getByText(/All caught up/i);
  });
});
