// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { RosterTable, type RosterMember } from "./roster-table";

// The bug this guards against was never a save failure — the DB write
// always succeeded — so a mock is the right tool here: it isolates the
// client-side render contract (does the select reflect the chosen value
// after the action resolves?) from persistence, which is covered separately
// by reading actions.ts.
vi.mock("./actions", () => ({
  setMachineRole: vi.fn(async () => ({})),
  promoteToCaptain: vi.fn(async () => ({})),
  removeMember: vi.fn(async () => ({})),
}));

afterEach(cleanup);

describe("RosterTable machine-role select", () => {
  it("keeps the newly chosen machine role after the save action resolves, instead of reverting to the original value", async () => {
    const members: RosterMember[] = [
      {
        id: "m1",
        name: "Coach Example",
        email: "coach@example.com",
        role: "coach",
        machineRole: null,
      },
    ];

    render(<RosterTable members={members} isCoach />);

    const select = screen.getByLabelText(
      /machine role for coach example/i,
    ) as HTMLSelectElement;
    expect(select.value).toBe("NONE");

    fireEvent.change(select, { target: { value: "LINUX" } });

    // The action resolves asynchronously — wait for the pending (disabled)
    // window to clear, which is when a defaultValue-based select would have
    // snapped back to its original value.
    await waitFor(() => expect(select.disabled).toBe(false));

    expect(select.value).toBe("LINUX");
  });
});
