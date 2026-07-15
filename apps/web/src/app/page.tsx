import { headers } from "next/headers";
import Link from "next/link";
import { Button } from "@roundzero/ui";

import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="flex flex-1 flex-col justify-between px-6 py-16">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6">
        <p className="text-[11px] uppercase tracking-[0.06em] text-text-dim">
          Training platform
        </p>
        <h1 className="text-[25px] font-semibold leading-[32px] text-text">
          Train for CyberPatriot.
        </h1>
        <p className="text-sm leading-6 text-text-dim">
          Free, browser-based practice for CyberPatriot teams — hardening
          drills, lessons, and a debrief that teaches.
        </p>
        <div>
          <Button asChild>
            <Link href="/app">{session ? "Open RoundZero" : "Sign in"}</Link>
          </Button>
        </div>
      </div>
      <p className="mx-auto max-w-xl text-xs text-text-dim">
        RoundZero is an independent, unofficial training platform and is not
        affiliated with or endorsed by the Air &amp; Space Forces Association
        or CyberPatriot.
      </p>
    </main>
  );
}
