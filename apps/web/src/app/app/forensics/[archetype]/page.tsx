import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FORENSICS_ARCHETYPES, prisma } from "@roundzero/db";
import { PageHeader } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { loadForensicsSet } from "@/lib/forensics-content";
import { ForensicsQuiz } from "./forensics-quiz";

export default async function ForensicsSetPage({
  params,
}: {
  params: Promise<{ archetype: string }>;
}) {
  const { archetype: archetypeKey } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const info = FORENSICS_ARCHETYPES.find((a) => a.key === archetypeKey);
  const set = info ? loadForensicsSet(archetypeKey) : null;
  if (!info || !set || set.length === 0) {
    notFound();
  }

  const progress = await prisma.forensicsProgress.findUnique({
    where: { userId_archetype: { userId: session.user.id, archetype: info.value } },
  });

  return (
    <div>
      <Link
        href="/app/forensics"
        className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        Forensics
      </Link>

      <PageHeader
        className="mt-3"
        title={info.label}
        support={
          progress
            ? `Best score so far: ${progress.bestScore}%. Retake anytime.`
            : `${set.length} question${set.length === 1 ? "" : "s"} — one at a time, then a short summary.`
        }
      />

      <ForensicsQuiz
        archetypeKey={archetypeKey}
        questions={set.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          given: question.given,
        }))}
      />
    </div>
  );
}
