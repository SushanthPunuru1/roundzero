import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@roundzero/db";

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
      <h1 className="text-[25px] font-semibold leading-[32px] text-text">
        Set up your team
      </h1>
      <p className="mt-1 text-sm text-text-dim">
        Create a new roster as coach, or join one with a code from your team.
      </p>
      <div className="mt-8">
        <TeamChooser />
      </div>
    </div>
  );
}
