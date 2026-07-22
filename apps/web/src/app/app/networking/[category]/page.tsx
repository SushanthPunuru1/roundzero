import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@roundzero/db";
import { PageHeader } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { NETWORKING_QUIZ_CATEGORIES, loadNetworkingQuizSet } from "@/lib/networking-quiz-content";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { completeQuizSet, gradeQuizQuestion } from "./actions";

const QUIZ_ID = "networking";

export default async function NetworkingQuizSetPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const info = NETWORKING_QUIZ_CATEGORIES.find((c) => c.key === category);
  const set = info ? loadNetworkingQuizSet(category) : null;
  if (!info || !set || set.length === 0) {
    notFound();
  }

  const progress = await prisma.quizProgress.findUnique({
    where: { userId_quizId_category: { userId: session.user.id, quizId: QUIZ_ID, category } },
  });

  return (
    <div>
      <Link
        href="/app/networking"
        className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        Networking
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

      <QuizRunner
        questions={set.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          given: question.given,
        }))}
        onGrade={gradeQuizQuestion}
        onComplete={completeQuizSet.bind(null, category)}
        backHref="/app/networking"
        backLabel="Back to networking"
      />
    </div>
  );
}
