import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader, Stat, StatStrip } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { loadDrill } from "@/lib/drill";
import { DrillSession } from "./drill-session";

export default async function DrillPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const drill = await loadDrill(session.user.id);

  return (
    <div>
      <PageHeader eyebrow="Practice" title="Daily drill" />
      <p className="mt-1 text-sm text-text-dim">
        A few minutes of spaced review. Space to reveal, 1&ndash;4 to rate.
      </p>
      <StatStrip className="mt-6">
        <Stat label="Due today" value={drill.dueCount} />
        <Stat label="Streak" value={`${drill.streak} day${drill.streak === 1 ? "" : "s"}`} />
      </StatStrip>

      <DrillSession queue={drill.queue} />
    </div>
  );
}
