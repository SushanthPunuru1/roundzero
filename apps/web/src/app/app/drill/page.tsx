import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader, Stat, StatStrip } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { loadDrill } from "@/lib/drill";
import { loadTrack, nextStepView } from "@/lib/track";
import { DrillSession } from "./drill-session";

export default async function DrillPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const [drill, track] = await Promise.all([
    loadDrill(session.user.id),
    loadTrack(session.user.id),
  ]);
  // Don't suggest the drill itself as the next step once it's done.
  const nextStep = nextStepView(track.steps.filter((s) => s.kind !== "drill"));

  return (
    <div>
      <PageHeader eyebrow="Practice" title="Daily drill" />
      <p className="mt-1 text-sm text-text-dim">
        Recall the answer, reveal it, then rate how well you knew it &mdash; you're
        grading your own memory, not taking a quiz. Space to reveal, 1&ndash;4 to rate.
      </p>
      <StatStrip className="mt-6">
        <Stat label="Due today" value={drill.dueCount} />
        <Stat label="Streak" value={`${drill.streak} day${drill.streak === 1 ? "" : "s"}`} />
      </StatStrip>

      <DrillSession queue={drill.queue} nextStep={nextStep} />
    </div>
  );
}
