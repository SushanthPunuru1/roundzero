import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect("/app");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-md border border-hairline bg-surface p-8">
        <p className="text-[11px] uppercase tracking-[0.06em] text-text-dim">
          RoundZero
        </p>
        <h1 className="mt-2 text-xl font-semibold text-text">Sign in</h1>
        <p className="mt-1 text-sm text-text-dim">
          CyberPatriot training platform for your team.
        </p>
        <div className="mt-6">
          <SignInForm />
        </div>
      </div>
    </div>
  );
}
