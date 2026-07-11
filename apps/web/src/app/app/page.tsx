import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { viewerFromSession } from "@/lib/auth-helpers";
import { SignOutButton } from "./sign-out-button";

export default async function AppPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const viewer = viewerFromSession(session);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-md border border-hairline bg-surface p-8">
        <p className="text-[11px] uppercase tracking-[0.06em] text-text-dim">
          RoundZero
        </p>
        <h1 className="mt-2 text-xl font-semibold text-text">
          {viewer.name}
        </h1>
        <p className="mt-1 font-mono text-sm text-text-dim">
          {viewer.email}
        </p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
