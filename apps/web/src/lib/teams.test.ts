import { describe, expect, it } from "vitest";
import {
  canJoinTeam,
  canManageRoster,
  canPromoteToCaptain,
  canRemoveMember,
  divisionLabel,
  isValidJoinCodeFormat,
  machineRoleLabel,
  normalizeJoinCode,
  roleLabel,
  slugifyTeamName,
  sortRosterMembers,
} from "./teams";

describe("normalizeJoinCode", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeJoinCode("  abcd1234  ")).toBe("abcd1234");
  });

  it("lowercases the code", () => {
    expect(normalizeJoinCode("ABCD1234")).toBe("abcd1234");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeJoinCode("   ")).toBe("");
  });
});

describe("isValidJoinCodeFormat", () => {
  it("accepts a cuid-shaped code", () => {
    expect(isValidJoinCodeFormat("cme1a2b3c4d5e6f7g8h9")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidJoinCodeFormat("")).toBe(false);
  });

  it("rejects codes shorter than 8 characters", () => {
    expect(isValidJoinCodeFormat("abc123")).toBe(false);
  });

  it("rejects codes with symbols or spaces", () => {
    expect(isValidJoinCodeFormat("abcd 1234")).toBe(false);
    expect(isValidJoinCodeFormat("abcd-1234")).toBe(false);
  });

  it("rejects uppercase (callers must normalize first)", () => {
    expect(isValidJoinCodeFormat("ABCD1234")).toBe(false);
  });
});

describe("canJoinTeam", () => {
  it("allows joining when the user has no current membership", () => {
    expect(canJoinTeam({ currentMembershipCount: 0 })).toEqual({ ok: true });
  });

  it("denies joining when the user already belongs to a team", () => {
    const result = canJoinTeam({ currentMembershipCount: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/already on a team/i);
    }
  });
});

describe("canManageRoster", () => {
  it("allows a coach", () => {
    expect(canManageRoster("coach")).toBe(true);
  });

  it("denies a captain", () => {
    expect(canManageRoster("captain")).toBe(false);
  });

  it("denies a member", () => {
    expect(canManageRoster("member")).toBe(false);
  });
});

describe("canPromoteToCaptain", () => {
  it("allows promoting a plain member", () => {
    expect(canPromoteToCaptain("member")).toBe(true);
  });

  it("denies promoting an existing captain", () => {
    expect(canPromoteToCaptain("captain")).toBe(false);
  });

  it("denies promoting the coach", () => {
    expect(canPromoteToCaptain("coach")).toBe(false);
  });
});

describe("canRemoveMember", () => {
  it("allows removing a member", () => {
    expect(canRemoveMember("member")).toBe(true);
  });

  it("allows removing a captain", () => {
    expect(canRemoveMember("captain")).toBe(true);
  });

  it("denies removing the coach", () => {
    expect(canRemoveMember("coach")).toBe(false);
  });
});

describe("slugifyTeamName", () => {
  it("kebab-cases the name and appends the suffix", () => {
    expect(slugifyTeamName("Wildcats CyberPatriot", "ab12cd")).toBe(
      "wildcats-cyberpatriot-ab12cd",
    );
  });

  it("strips punctuation and collapses repeated separators", () => {
    expect(slugifyTeamName("Team #1 -- Alpha!!", "xy9z")).toBe(
      "team-1-alpha-xy9z",
    );
  });

  it("falls back to 'team' when the name has no alphanumeric characters", () => {
    expect(slugifyTeamName("★★★", "ab12cd")).toBe("team-ab12cd");
  });

  it("lowercases the suffix", () => {
    expect(slugifyTeamName("Alpha", "AB12CD")).toBe("alpha-ab12cd");
  });
});

describe("sortRosterMembers", () => {
  it("orders coach first, then captains, then members", () => {
    const members = [
      { id: "1", role: "member", createdAt: "2026-01-03" },
      { id: "2", role: "coach", createdAt: "2026-01-01" },
      { id: "3", role: "captain", createdAt: "2026-01-02" },
    ];
    expect(sortRosterMembers(members).map((m) => m.id)).toEqual([
      "2",
      "3",
      "1",
    ]);
  });

  it("breaks ties within the same role by join order", () => {
    const members = [
      { id: "b", role: "member", createdAt: "2026-01-02" },
      { id: "a", role: "member", createdAt: "2026-01-01" },
    ];
    expect(sortRosterMembers(members).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const members = [
      { id: "1", role: "member", createdAt: "2026-01-01" },
      { id: "2", role: "coach", createdAt: "2026-01-01" },
    ];
    const original = [...members];
    sortRosterMembers(members);
    expect(members).toEqual(original);
  });
});

describe("label maps", () => {
  it("labels divisions in sentence case", () => {
    expect(divisionLabel("OPEN")).toBe("Open");
    expect(divisionLabel("ALL_SERVICE")).toBe("All-Service");
    expect(divisionLabel("MIDDLE_SCHOOL")).toBe("Middle school");
  });

  it("labels machine roles, defaulting to unassigned", () => {
    expect(machineRoleLabel("WINDOWS")).toBe("Windows");
    expect(machineRoleLabel("LINUX")).toBe("Linux");
    expect(machineRoleLabel("CISCO")).toBe("Cisco");
    expect(machineRoleLabel(null)).toBe("Unassigned");
    expect(machineRoleLabel(undefined)).toBe("Unassigned");
  });

  it("labels team roles", () => {
    expect(roleLabel("coach")).toBe("Coach");
    expect(roleLabel("captain")).toBe("Captain");
    expect(roleLabel("member")).toBe("Member");
  });
});
