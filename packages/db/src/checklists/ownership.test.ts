import { describe, expect, it } from "vitest";

import {
  canEditFork,
  canEditTeamFork,
  canViewFork,
  forkOwnerKind,
  forkOwnerLabel,
  type ForkOwner,
  type ForkViewer,
} from "./ownership";

const SOLO: ForkViewer = { userId: "u1", memberOrganizationId: null, memberRole: null };
const COACH: ForkViewer = { userId: "u2", memberOrganizationId: "org1", memberRole: "coach" };
const CAPTAIN: ForkViewer = { userId: "u3", memberOrganizationId: "org1", memberRole: "captain" };
const MEMBER: ForkViewer = { userId: "u4", memberOrganizationId: "org1", memberRole: "member" };
const OTHER_TEAM: ForkViewer = { userId: "u5", memberOrganizationId: "org2", memberRole: "coach" };

const personal = (userId: string): ForkOwner => ({ userId, organizationId: null });
const team = (organizationId: string): ForkOwner => ({ userId: null, organizationId });

describe("forkOwnerKind", () => {
  it("classifies a user-owned row as personal and an org-owned row as team", () => {
    expect(forkOwnerKind(personal("u1"))).toBe("personal");
    expect(forkOwnerKind(team("org1"))).toBe("team");
  });

  // Both violations collapse to one state on purpose: a malformed row should
  // be inaccessible, not silently resolved by picking a column.
  it("treats both-set and neither-set as invalid", () => {
    expect(forkOwnerKind({ userId: "u1", organizationId: "org1" })).toBe("invalid");
    expect(forkOwnerKind({ userId: null, organizationId: null })).toBe("invalid");
  });
});

describe("canEditFork — personal", () => {
  // The whole reason this module exists: a learner with no team was
  // previously unable to edit anything, because every path went through a
  // Member row they don't have.
  it("lets a teamless learner edit their own fork", () => {
    expect(canEditFork(personal("u1"), SOLO)).toBe(true);
  });

  it("does not consult a role — there is no role to have", () => {
    const soloWithStrayRole: ForkViewer = { ...SOLO, memberRole: "member" };
    expect(canEditFork(personal("u1"), soloWithStrayRole)).toBe(true);
  });

  it("refuses another user's personal fork, even to a coach", () => {
    expect(canEditFork(personal("someone-else"), SOLO)).toBe(false);
    expect(canEditFork(personal("someone-else"), COACH)).toBe(false);
  });
});

describe("canEditFork — team", () => {
  it("keeps the original rule: coach and captain edit, member does not", () => {
    expect(canEditFork(team("org1"), COACH)).toBe(true);
    expect(canEditFork(team("org1"), CAPTAIN)).toBe(true);
    expect(canEditFork(team("org1"), MEMBER)).toBe(false);
  });

  it("refuses a coach of a different organization", () => {
    expect(canEditFork(team("org1"), OTHER_TEAM)).toBe(false);
  });

  it("refuses a teamless learner", () => {
    expect(canEditFork(team("org1"), SOLO)).toBe(false);
  });

  it("refuses an invalid row outright", () => {
    expect(canEditFork({ userId: "u1", organizationId: "org1" }, SOLO)).toBe(false);
    expect(canEditFork({ userId: null, organizationId: null }, COACH)).toBe(false);
  });
});

describe("canViewFork", () => {
  // Viewing and editing are separate questions: a plain member sees the team
  // fork read-only, which is why this isn't derived from canEditFork.
  it("lets a plain member view a team fork they cannot edit", () => {
    expect(canViewFork(team("org1"), MEMBER)).toBe(true);
    expect(canEditFork(team("org1"), MEMBER)).toBe(false);
  });

  it("hides a personal fork from everyone but its owner", () => {
    expect(canViewFork(personal("u1"), SOLO)).toBe(true);
    expect(canViewFork(personal("u1"), COACH)).toBe(false);
  });

  it("hides another organization's fork", () => {
    expect(canViewFork(team("org1"), OTHER_TEAM)).toBe(false);
  });
});

describe("canEditTeamFork", () => {
  it("accepts coach and captain only", () => {
    expect(canEditTeamFork("coach")).toBe(true);
    expect(canEditTeamFork("captain")).toBe(true);
    expect(canEditTeamFork("member")).toBe(false);
    expect(canEditTeamFork("")).toBe(false);
  });
});

describe("forkOwnerLabel", () => {
  it("does not tell a solo learner their own copy belongs to a team", () => {
    expect(forkOwnerLabel(personal("u1"))).toContain("Your customized copy");
    expect(forkOwnerLabel(personal("u1"))).not.toContain("team");
  });

  it("still says team for a team-owned fork", () => {
    expect(forkOwnerLabel(team("org1"))).toContain("Your team's fork");
  });
});
