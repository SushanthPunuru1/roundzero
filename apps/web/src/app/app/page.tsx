import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@roundzero/db";
import { PageHeader } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { TeamChooser } from "./team-chooser";

export default async function AppPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
  });
  if (membership) {
    redirect("/app/team");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Team setup"
        title="Set up your team"
        support="Create a new roster as coach, or join one with a code from your team."
      />
      <div className="mt-8">
        <TeamChooser />
      </div>
    </div>
  );
}
