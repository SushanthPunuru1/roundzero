// Server-only: resolves which checklist fork a viewer sees, and whether they
// may edit it. Deliberately NOT in lib/checklist-fork.ts — that module is
// imported by fork-editor.tsx, a client component, and pulling Prisma into it
// would drag the client bundle back into the failure DECISIONS 034/036
// describes.
//
// Resolution order is personal-first. A learner's own fork is the normal case
// under the individual-first scope; a team-owned fork is the legacy one that
// still has to keep working (DECISIONS 040/043).

import { prisma, canEditFork, type Prisma, type ForkViewer } from "@roundzero/db";

/** The row shape the pages actually consume — Prisma's own payload helper, so
 * `items` is typed by the include rather than dropped from it. */
type ForkWithItems = Prisma.TeamChecklistGetPayload<{ include: { items: true } }>;

export interface ResolvedForkAccess {
  /** The fork to render, or null when the viewer has none for this template. */
  fork: ForkWithItems | null;
  /** Whether the viewer may mutate it. False for a plain member on a team
   * fork — they still see it, read-only. */
  canEdit: boolean;
  /** True when the viewer could create a fork but doesn't have one yet. */
  canCreate: boolean;
}

/**
 * Loads the viewer's fork of `templateId`, preferring their personal copy over
 * their team's. Membership is looked up once and only used for the team case —
 * a learner with no Member row resolves their own fork fine, which is the
 * behaviour this whole change exists to restore.
 */
export async function loadForkForViewer(
  userId: string,
  templateId: string,
): Promise<ResolvedForkAccess> {
  const member = await prisma.member.findFirst({ where: { userId } });

  const personal = await prisma.teamChecklist.findFirst({
    where: { userId, sourceId: templateId },
    include: { items: true },
  });

  const fork =
    personal ??
    (member
      ? await prisma.teamChecklist.findFirst({
          where: { organizationId: member.organizationId, sourceId: templateId },
          include: { items: true },
        })
      : null);

  if (!fork) {
    // Everyone signed in can create their own copy — there is no role gate on
    // a fork that belongs to you alone.
    return { fork: null, canEdit: false, canCreate: true };
  }

  const viewer: ForkViewer = {
    userId,
    memberOrganizationId: member?.organizationId ?? null,
    memberRole: member?.role ?? null,
  };

  return { fork, canEdit: canEditFork(fork, viewer), canCreate: false };
}
