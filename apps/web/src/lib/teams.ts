// Pure team domain logic — no DB/framework imports, fully unit-testable.
// Server actions (apps/app/team, apps/app/team/actions.ts) call into these
// and layer the Prisma/session/zod plumbing on top.

export type TeamRole = "coach" | "captain" | "member";
export type Division = "OPEN" | "ALL_SERVICE" | "MIDDLE_SCHOOL";
export type MachineRole = "WINDOWS" | "LINUX" | "CISCO";

const JOIN_CODE_PATTERN = /^[a-z0-9]{8,}$/;

export function normalizeJoinCode(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidJoinCodeFormat(code: string): boolean {
  return JOIN_CODE_PATTERN.test(code);
}

export function canJoinTeam(input: {
  currentMembershipCount: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.currentMembershipCount > 0) {
    return {
      ok: false,
      reason:
        "You're already on a team. Leave your current team before joining another.",
    };
  }
  return { ok: true };
}

export function canManageRoster(role: string): boolean {
  return role === "coach";
}

export function canPromoteToCaptain(targetRole: string): boolean {
  return targetRole === "member";
}

export function canRemoveMember(targetRole: string): boolean {
  return targetRole !== "coach";
}

export function slugifyTeamName(name: string, suffix: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return `${base || "team"}-${suffix.toLowerCase()}`;
}

const ROLE_RANK: Record<string, number> = { coach: 0, captain: 1, member: 2 };

export function sortRosterMembers<
  T extends { role: string; createdAt: Date | string },
>(members: T[]): T[] {
  return [...members].sort((a, b) => {
    const rankDiff = (ROLE_RANK[a.role] ?? 3) - (ROLE_RANK[b.role] ?? 3);
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function divisionLabel(division: Division): string {
  switch (division) {
    case "OPEN":
      return "Open";
    case "ALL_SERVICE":
      return "All-Service";
    case "MIDDLE_SCHOOL":
      return "Middle school";
  }
}

export function machineRoleLabel(
  role: MachineRole | null | undefined,
): string {
  switch (role) {
    case "WINDOWS":
      return "Windows";
    case "LINUX":
      return "Linux";
    case "CISCO":
      return "Cisco";
    default:
      return "Unassigned";
  }
}

export function roleLabel(role: string): string {
  switch (role) {
    case "coach":
      return "Coach";
    case "captain":
      return "Captain";
    case "member":
      return "Member";
    default:
      return role;
  }
}
