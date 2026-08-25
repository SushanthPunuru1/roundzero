import { beforeEach, describe, expect, it, vi } from "vitest";

import { setForkItemRemoved } from "./actions";

// fork.test.ts (packages/db) covers the pure toggle: given a ForkItemRow
// with removed set, diffFork/resolveFork treat it correctly. It never
// touches this file's form-parsing → Prisma-write wiring, which is exactly
// where a copy-pasted hidden `removed="true"` input or an inverted
// comparison would hide. auth/db/next/* are mocked so this exercises the
// real setForkItemRemoved against a fake row, round-tripping remove then
// restore the way the fork editor's Remove button and the Restore button
// (both fork-editor.tsx and diff-view.tsx) actually call it.

const { prismaMock, canEditForkMock } = vi.hoisted(() => ({
  prismaMock: {
    teamChecklist: { findUnique: vi.fn() },
    member: { findFirst: vi.fn() },
    teamChecklistItem: { findUnique: vi.fn(), update: vi.fn() },
  },
  // The authorization DECISION is pure and covered exhaustively by
  // packages/db checklists/ownership.test.ts. What this file has to prove is
  // that the guard is actually WIRED to it — hence a mock whose return value
  // the last test flips.
  canEditForkMock: vi.fn(() => true),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect() should not be called in this test");
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({ user: { id: "user-1" } })),
    },
  },
}));

vi.mock("@roundzero/db", () => ({
  prisma: prismaMock,
  Prisma: {},
  canEditFork: canEditForkMock,
  initialForkItems: vi.fn(),
  reorder: vi.fn(),
}));

function removeFormData(removed: "true" | "false") {
  const formData = new FormData();
  formData.set("teamChecklistId", "tc1");
  formData.set("itemId", "item1");
  formData.set("removed", removed);
  return formData;
}

describe("setForkItemRemoved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canEditForkMock.mockReturnValue(true);
    // A PERSONAL fork — the default shape under the individual-first scope
    // (DECISIONS 043). organizationId null means the guard must never reach
    // for a Member row, which the last test in this file asserts directly.
    prismaMock.teamChecklist.findUnique.mockResolvedValue({
      id: "tc1",
      userId: "user-1",
      organizationId: null,
      sourceId: "linux-core",
    });
    prismaMock.member.findFirst.mockResolvedValue(null);
  });

  it("round-trips remove then restore, writing removed: false on restore rather than reusing the remove call's true", async () => {
    // A fake row standing in for the DB — findUnique/update read and write
    // it, so the update's `data` actually has to carry the right value for
    // the second call to undo the first, not just be asserted in isolation.
    let row = { id: "item1", teamChecklistId: "tc1", removed: false };
    prismaMock.teamChecklistItem.findUnique.mockImplementation(async () => ({ ...row }));
    prismaMock.teamChecklistItem.update.mockImplementation(async ({ data }: { data: { removed: boolean } }) => {
      row = { ...row, ...data };
      return row;
    });

    const removeResult = await setForkItemRemoved({}, removeFormData("true"));
    expect(removeResult.error).toBeUndefined();
    expect(prismaMock.teamChecklistItem.update).toHaveBeenLastCalledWith({
      where: { id: "item1" },
      data: { removed: true },
    });
    expect(row.removed).toBe(true);

    const restoreResult = await setForkItemRemoved({}, removeFormData("false"));
    expect(restoreResult.error).toBeUndefined();
    expect(prismaMock.teamChecklistItem.update).toHaveBeenLastCalledWith({
      where: { id: "item1" },
      data: { removed: false },
    });
    expect(row.removed).toBe(false);
  });

  it("rejects a removed value outside true/false instead of silently writing something", async () => {
    prismaMock.teamChecklistItem.findUnique.mockResolvedValue({
      id: "item1",
      teamChecklistId: "tc1",
      removed: false,
    });

    const formData = new FormData();
    formData.set("teamChecklistId", "tc1");
    formData.set("itemId", "item1");
    formData.set("removed", "yes");

    const result = await setForkItemRemoved({}, formData);
    expect(result.error).toBeDefined();
    expect(prismaMock.teamChecklistItem.update).not.toHaveBeenCalled();
  });

  // The regression this exists to prevent: a teamless learner editing their
  // OWN fork used to be refused, because the guard reached for a Member row
  // they don't have and bailed when it came back null. The membership lookup
  // must not happen at all for a personal fork.
  it("edits a personal fork without ever looking up a membership", async () => {
    prismaMock.teamChecklistItem.findUnique.mockResolvedValue({
      id: "item1",
      teamChecklistId: "tc1",
      removed: false,
    });
    prismaMock.teamChecklistItem.update.mockResolvedValue({});

    const result = await setForkItemRemoved({}, removeFormData("true"));

    expect(result.error).toBeUndefined();
    expect(prismaMock.member.findFirst).not.toHaveBeenCalled();
    expect(canEditForkMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", organizationId: null }),
      expect.objectContaining({ userId: "user-1", memberOrganizationId: null, memberRole: null }),
    );
  });

  // Authorization is enforced in the action, not just hidden in the UI: a
  // direct invocation by someone the decision refuses still gets nothing.
  it("refuses the write when the ownership check says no", async () => {
    canEditForkMock.mockReturnValue(false);
    prismaMock.teamChecklistItem.findUnique.mockResolvedValue({
      id: "item1",
      teamChecklistId: "tc1",
      removed: false,
    });

    const result = await setForkItemRemoved({}, removeFormData("true"));

    expect(result.error).toBeDefined();
    expect(prismaMock.teamChecklistItem.update).not.toHaveBeenCalled();
  });
});
