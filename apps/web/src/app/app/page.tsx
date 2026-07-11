import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@roundzero/db";

import { auth } from "@/lib/auth";
import { viewerFromSession } from "@/lib/auth-helpers";
import { SignOutButton } from "./sign-out-button";
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

  const viewer = viewerFromSession(session);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.06em] text-text-dim">
            RoundZero
          </p>
          <h1 className="mt-2 text-xl font-semibold text-text">
            Get your team set up
          </h1>
          <p className="mt-1 text-sm text-text-dim">
            Signed in as <span className="font-mono text-text">{viewer.email}</span>
          </p>
        </div>
        <SignOutButton className="w-auto" />
      </div>
      <div className="mt-8">
        <TeamChooser />
      </div>
    </div>
  );
}
