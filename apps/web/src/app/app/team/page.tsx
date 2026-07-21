import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@roundzero/db";
import { Badge, Card, PageHeader, Stat, StatStrip } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { canManageRoster, divisionLabel, sortRosterMembers } from "@/lib/teams";
import { JoinCode } from "./join-code";
import { RosterTable } from "./roster-table";

export default async function TeamPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  });
  if (!membership) {
    redirect("/app");
  }

  const members = await prisma.member.findMany({
    where: { organizationId: membership.organizationId },
    include: { user: { select: { name: true, email: true } } },
  });

  const roster = sortRosterMembers(members);
  const isCoach = canManageRoster(membership.role);
  const rolesFilled = new Set(
    roster.map((member) => member.machineRole).filter(Boolean),
  ).size;

  return (
    <div>
      <PageHeader
        eyebrow="Team"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {membership.organization.name}
            <Badge>{divisionLabel(membership.organization.division)}</Badge>
          </span>
        }
        support={`${roster.length} ${roster.length === 1 ? "member" : "members"}`}
        actions={
          isCoach && roster.length > 1 ? (
            <JoinCode code={membership.organization.joinCode} />
          ) : undefined
        }
      />
      <StatStrip className="mt-6">
        <Stat label="Members" value={roster.length} />
        <Stat label="Roles filled" value={`${rolesFilled}/3`} />
        <Stat label="Division" value={divisionLabel(membership.organization.division)} />
      </StatStrip>
      <div className="mt-8">
        {roster.length === 1 && isCoach ? (
          <Card className="flex flex-col items-start gap-4 p-8">
            <div>
              <p className="text-base font-semibold text-text">
                Your roster is just you
              </p>
              <p className="mt-1 text-sm text-text-dim">
                Share the join code with your team so they can add themselves.
              </p>
            </div>
            <JoinCode code={membership.organization.joinCode} variant="panel" />
          </Card>
        ) : (
          <RosterTable
            members={roster.map((member) => ({
              id: member.id,
              name: member.user.name?.trim() || member.user.email,
              email: member.user.email,
              role: member.role,
              machineRole: member.machineRole,
            }))}
            isCoach={isCoach}
          />
        )}
      </div>
    </div>
  );
}
