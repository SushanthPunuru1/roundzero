import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@roundzero/db";
import { Badge, PageHeader } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { canManageRoster, divisionLabel, sortRosterMembers } from "@/lib/teams";
import { SignOutButton } from "../sign-out-button";
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeader
        eyebrow="RoundZero"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {membership.organization.name}
            <Badge>{divisionLabel(membership.organization.division)}</Badge>
          </span>
        }
        actions={
          <>
            {isCoach && <JoinCode code={membership.organization.joinCode} />}
            <SignOutButton className="w-auto" />
          </>
        }
      />
      <div className="mt-6">
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
      </div>
    </div>
  );
}
