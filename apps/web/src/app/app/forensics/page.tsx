import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Fingerprint, CircleCheck, Circle } from "lucide-react";
import { FORENSICS_ARCHETYPES, prisma } from "@roundzero/db";
import { EmptyState, PageHeader, Stat, StatStrip } from "@roundzero/ui";

import { auth } from "@/lib/auth";

export default async function ForensicsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const [questions, progress] = await Promise.all([
    prisma.forensicsQuestion.findMany({ select: { archetype: true } }),
    prisma.forensicsProgress.findMany({ where: { userId: session.user.id } }),
  ]);

  const countByArchetype = new Map<string, number>();
  for (const question of questions) {
    countByArchetype.set(question.archetype, (countByArchetype.get(question.archetype) ?? 0) + 1);
  }
  const bestScoreByArchetype = new Map(progress.map((row) => [row.archetype, row.bestScore]));

  const sets = FORENSICS_ARCHETYPES.map((archetype) => ({
    ...archetype,
    questionCount: countByArchetype.get(archetype.value) ?? 0,
    bestScore: bestScoreByArchetype.get(archetype.value) ?? null,
  })).filter((set) => set.questionCount > 0);

  const completedCount = sets.filter((set) => set.bestScore !== null).length;

  return (
    <div>
      <PageHeader
        eyebrow="Training"
        title="Forensics"
        support="Short, self-contained CyberPatriot-style questions — no box required. Answers are graded as exact strings, just like the real thing."
      />
      <StatStrip className="mt-6">
        <Stat label="Sets available" value={sets.length} />
        <Stat label="Completed" value={`${completedCount}/${sets.length}`} />
      </StatStrip>

      <div className="mt-8 flex flex-col gap-2">
        {sets.length === 0 ? (
          <EmptyState
            icon={Fingerprint}
            message="No forensics questions published yet — check back soon."
          />
        ) : (
          sets.map((set) => {
            const attempted = set.bestScore !== null;
            return (
              <Link
                key={set.key}
                href={`/app/forensics/${set.key}`}
                className="group flex items-center justify-between gap-4 rounded-md border border-hairline bg-surface px-4 py-3 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <span className="flex items-center gap-3">
                  {attempted ? (
                    <CircleCheck
                      className="size-4 shrink-0 text-score"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="size-4 shrink-0 text-text-dim"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-sm font-medium text-text">{set.label}</span>
                  <span className="sr-only">
                    {attempted ? `Attempted, best score ${set.bestScore}%` : "Not attempted"}
                  </span>
                </span>
                <span className="flex items-center gap-3 text-xs text-text-dim">
                  {attempted && (
                    <span className="font-mono tabular-nums text-score">{set.bestScore}%</span>
                  )}
                  <span className="font-mono tabular-nums">
                    {set.questionCount} question{set.questionCount === 1 ? "" : "s"}
                  </span>
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
