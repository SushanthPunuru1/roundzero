// Who owns a checklist fork, and who may edit it. Pure — no DB or framework
// imports; the pages and server actions in apps/web do the Prisma lookups and
// call in here for the decision.
//
// A fork is owned by EXACTLY ONE of a user or an organization. Personal forks
// arrived with the individual-first scope (DECISIONS 040/043): TeamChecklist
// was organization-only, so a learner with no Member row could never create,
// edit, or diff one — the shipped trio was unreachable for the only user the
// product is scoped to. Team-owned rows still exist and still work; nothing
// new creates them.

/** The owner columns of a TeamChecklist row, as stored. */
export interface ForkOwner {
  userId: string | null;
  organizationId: string | null;
}

/** What the viewer is: their user id, plus their membership if they have one.
 * `memberOrganizationId`/`memberRole` are null for a learner with no team,
 * which is the default case, not an edge case. */
export interface ForkViewer {
  userId: string;
  memberOrganizationId: string | null;
  memberRole: string | null;
}

export type ForkOwnerKind = "personal" | "team" | "invalid";

/** Coach or captain may edit a TEAM-owned fork; plain members get read-only.
 * Personal forks don't consult this at all — see canEditFork. */
export function canEditTeamFork(role: string): boolean {
  return role === "coach" || role === "captain";
}

/**
 * Classifies a fork by its owner columns. "invalid" covers both violations of
 * the exactly-one rule (neither set, or both set) so callers can treat a
 * malformed row as inaccessible rather than guessing which column wins.
 */
export function forkOwnerKind(owner: ForkOwner): ForkOwnerKind {
  const hasUser = owner.userId !== null;
  const hasOrg = owner.organizationId !== null;
  if (hasUser === hasOrg) return "invalid";
  return hasUser ? "personal" : "team";
}

/**
 * Whether the viewer may SEE this fork. A personal fork is visible only to
 * its owner; a team fork only to a member of that organization, whatever
 * their role.
 */
export function canViewFork(owner: ForkOwner, viewer: ForkViewer): boolean {
  switch (forkOwnerKind(owner)) {
    case "personal":
      return owner.userId === viewer.userId;
    case "team":
      return owner.organizationId === viewer.memberOrganizationId;
    case "invalid":
      return false;
  }
}

/**
 * Whether the viewer may MUTATE this fork. Your own fork is always yours to
 * edit — no role check, because there is no role to have. A team fork keeps
 * the original rule: same organization, and coach or captain.
 *
 * Visibility is deliberately not implied by editability being false: a plain
 * member can view a team fork and not edit it, which is why the two questions
 * are separate functions rather than one nullable result.
 */
export function canEditFork(owner: ForkOwner, viewer: ForkViewer): boolean {
  switch (forkOwnerKind(owner)) {
    case "personal":
      return owner.userId === viewer.userId;
    case "team":
      return (
        owner.organizationId === viewer.memberOrganizationId &&
        viewer.memberRole !== null &&
        canEditTeamFork(viewer.memberRole)
      );
    case "invalid":
      return false;
  }
}

/** The one-line support text under a fork's page header. Says whose it is,
 * because "your team's fork" on a solo learner's own copy is exactly the
 * wrong thing to tell them. */
export function forkOwnerLabel(owner: ForkOwner): string {
  switch (forkOwnerKind(owner)) {
    case "personal":
      return "Your customized copy. Untouched items keep inheriting upstream corrections.";
    case "team":
      return "Your team's fork. Untouched items keep inheriting upstream corrections.";
    case "invalid":
      return "This checklist copy has no owner.";
  }
}
