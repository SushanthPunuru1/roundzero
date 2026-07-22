import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Network, CircleCheck, Circle, Info } from "lucide-react";
import { prisma } from "@roundzero/db";
import { Card, EmptyState, PageHeader, Stat, StatStrip } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { NETWORKING_QUIZ_CATEGORIES, loadNetworkingQuizQuestions } from "@/lib/networking-quiz-content";

const QUIZ_ID = "networking";

export default async function NetworkingQuizPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const [questions, progress] = await Promise.all([
    loadNetworkingQuizQuestions(),
    prisma.quizProgress.findMany({ where: { userId: session.user.id, quizId: QUIZ_ID } }),
  ]);

  const countByCategory = new Map<string, number>();
  for (const question of questions) {
    countByCategory.set(question.category, (countByCategory.get(question.category) ?? 0) + 1);
  }
  const bestScoreByCategory = new Map(progress.map((row) => [row.category, row.bestScore]));

  const sets = NETWORKING_QUIZ_CATEGORIES.map((category) => ({
    ...category,
    questionCount: countByCategory.get(category.key) ?? 0,
    bestScore: bestScoreByCategory.get(category.key) ?? null,
  })).filter((set) => set.questionCount > 0);

  const completedCount = sets.filter((set) => set.bestScore !== null).length;

  return (
    <div>
      <PageHeader
        eyebrow="Training"
        title="Networking"
        support="Subnetting, ports, protocols, IOS commands, device hardening, and VLAN/ACL logic — the knowledge half of the Cisco Networking Challenge."
      />
      <StatStrip className="mt-6">
        <Stat label="Sets available" value={sets.length} />
        <Stat label="Completed" value={`${completedCount}/${sets.length}`} />
      </StatStrip>

      <Card className="mt-8 flex items-start gap-3 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
        <p className="text-sm text-text-dim">
          RoundZero trains the knowledge, IOS commands, and subnetting math behind
          the Cisco Challenge. The hands-on network build happens in{" "}
          <a
            href="https://www.netacad.com/courses/packet-tracer"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline underline-offset-2 hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Cisco Packet Tracer
          </a>{" "}
          itself, free from Cisco&apos;s Networking Academy — RoundZero doesn&apos;t
          simulate it.
        </p>
      </Card>

      <div className="mt-8 flex flex-col gap-2">
        {sets.length === 0 ? (
          <EmptyState
            icon={Network}
            message="No networking questions published yet — check back soon."
          />
        ) : (
          sets.map((set) => {
            const attempted = set.bestScore !== null;
            return (
              <Link
                key={set.key}
                href={`/app/networking/${set.key}`}
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
