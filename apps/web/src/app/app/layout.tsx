import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { viewerFromSession } from "@/lib/auth-helpers";
import { countDueCards } from "@/lib/drill";
import { TopBar } from "./top-bar";
import { SiteFooter } from "@/components/site-footer";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const viewer = viewerFromSession(session);
  const dueCount = await countDueCards(session.user.id);

  return (
    <div className="flex min-h-full flex-col">
      <TopBar name={viewer.name} email={viewer.email} dueCount={dueCount} />
      <main className="flex-1">
        <div className="app-shell-content mx-auto max-w-[1100px] px-6 py-8">{children}</div>
      </main>
      {/* The affiliation disclaimer lived only on the marketing page, so a
          signed-in learner could use every screen in the product without ever
          seeing it. `main` already carries flex-1, so this sits at the bottom
          of short screens rather than floating under them. */}
      <SiteFooter />
    </div>
  );
}
