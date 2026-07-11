import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { viewerFromSession } from "@/lib/auth-helpers";
import { TopBar } from "./top-bar";

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

  return (
    <div className="flex min-h-full flex-col">
      <TopBar name={viewer.name} email={viewer.email} />
      <main className="flex-1">
        <div className="mx-auto max-w-[1100px] px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
