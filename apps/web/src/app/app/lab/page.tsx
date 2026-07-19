import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { LabConsole } from "./lab-console";

export default async function LabPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div>
      <PageHeader eyebrow="Practice" title="Lab" />
      <p className="mt-1 text-sm text-text-dim">
        Launch a real, intentionally vulnerable Linux box and get a live shell right here in the
        browser. Harden it, then score it to see what you found and what you missed.
      </p>
      <p className="mt-1 text-xs text-text-dim">
        Local-only for now — this works while you're running the lab broker on your own machine
        (see <span className="font-mono">lab-broker/README.md</span>); it isn't available on the
        hosted deployment yet.
      </p>

      <LabConsole />
    </div>
  );
}
