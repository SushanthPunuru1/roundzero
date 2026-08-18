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

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    teamChecklist: { findUnique: vi.fn() },
    member: { findFirst: vi.fn() },
    teamChecklistItem: { findUnique: vi.fn(), update: vi.fn() },
  },
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
    prismaMock.teamChecklist.findUnique.mockResolvedValue({
      id: "tc1",
      organizationId: "org1",
      sourceId: "linux-core",
    });
    prismaMock.member.findFirst.mockResolvedValue({ role: "coach" });
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
});
