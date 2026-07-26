import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { loadTrack, nextStepView } from "@/lib/track";
import { LabConsole } from "./lab-console";

export default async function LabPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const track = await loadTrack(session.user.id);
  // Don't suggest the lab itself as the next step from within the lab.
  const nextStep = nextStepView(track.steps.filter((s) => s.kind !== "lab"));

  return (
    <div>
      <PageHeader
        eyebrow="Practice"
        title="Lab"
        support="Launch a real, intentionally vulnerable Linux box and get a live shell right here in the browser. Harden it, then score it to see what you found and what you missed."
      />
      <p className="mt-1 text-xs text-text-dim">
        Local-only for now — this works while you're running the lab broker on your own machine
        (see <span className="font-mono">lab-broker/README.md</span>); it isn't available on the
        hosted deployment yet.
      </p>

      <LabConsole nextStep={nextStep} />
    </div>
  );
}
