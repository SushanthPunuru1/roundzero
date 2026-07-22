"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bestScore, gradeAnswer, prisma } from "@roundzero/db";
import type { FormatDiff, QuizGradeStatus } from "@roundzero/db";

import { auth } from "@/lib/auth";
import { NETWORKING_QUIZ_CATEGORIES, findNetworkingQuizQuestion, loadNetworkingQuizSet } from "@/lib/networking-quiz-content";
import { enqueueSkillNodeCards } from "@/lib/drill";

const QUIZ_ID = "networking";

export interface GradeQuizResult {
  error?: string;
  status?: QuizGradeStatus;
  diff?: FormatDiff;
  answer?: string;
  technique?: string | null;
  why?: string;
}

const GENERIC_ERROR = "Something went wrong grading that answer. Try again.";

const gradeSchema = z.object({
  questionId: z.string().min(1),
  submitted: z.string(),
});

/**
 * Grades a single question for immediate feedback. Never persists anything —
 * completeQuizSet re-grades authoritatively from the same content YAML when
 * the set finishes, so a tampered client can't inflate its own score. Same
 * discipline as forensics' gradeForensicsQuestion (DECISIONS 031).
 */
export async function gradeQuizQuestion(input: {
  questionId: string;
  submitted: string;
}): Promise<GradeQuizResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: GENERIC_ERROR };
  }

  const question = findNetworkingQuizQuestion(parsed.data.questionId);
  if (!question) {
    return { error: GENERIC_ERROR };
  }

  const graded = gradeAnswer(question, parsed.data.submitted);
  return {
    status: graded.status,
    diff: graded.diff,
    answer: question.answer,
    technique: question.technique,
    why: question.why,
  };
}

export interface CompleteQuizResult {
  error?: string;
  score?: number;
  correct?: number;
  total?: number;
  enqueued?: number;
}

const completeSchema = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1), submitted: z.string() })),
});

/**
 * Called once a set is finished. Re-grades every question authoritatively
 * from the content YAML, upserts the user's best score for this quiz
 * category, and enqueues missed questions' skill nodes into the SRS drill.
 *
 * `category` is a bound first argument (`completeQuizSet.bind(null,
 * category)` in the server component that renders `QuizRunner`), the same
 * pattern forensics' completeForensicsSet uses for `archetypeKey` — see
 * that file's comment for why.
 */
export async function completeQuizSet(
  category: string,
  input: { answers: { questionId: string; submitted: string }[] },
): Promise<CompleteQuizResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: GENERIC_ERROR };
  }

  const info = NETWORKING_QUIZ_CATEGORIES.find((c) => c.key === category);
  const set = loadNetworkingQuizSet(category);
  if (!info || !set || set.length === 0) {
    return { error: GENERIC_ERROR };
  }

  const submittedById = new Map(parsed.data.answers.map((a) => [a.questionId, a.submitted]));
  const missedSkillNodeIds: string[] = [];
  let correct = 0;
  for (const question of set) {
    const submitted = submittedById.get(question.id) ?? "";
    const graded = gradeAnswer(question, submitted);
    if (graded.status === "correct") {
      correct += 1;
    } else {
      missedSkillNodeIds.push(question.skillNodeId);
    }
  }

  const total = set.length;
  const score = Math.round((correct / total) * 100);

  const existing = await prisma.quizProgress.findUnique({
    where: { userId_quizId_category: { userId: session.user.id, quizId: QUIZ_ID, category } },
  });

  await prisma.quizProgress.upsert({
    where: { userId_quizId_category: { userId: session.user.id, quizId: QUIZ_ID, category } },
    create: { userId: session.user.id, quizId: QUIZ_ID, category, bestScore: score },
    update: { bestScore: bestScore(existing?.bestScore, score) },
  });

  const enqueued = await enqueueSkillNodeCards(session.user.id, missedSkillNodeIds, new Date());

  revalidatePath("/app/networking");
  revalidatePath(`/app/networking/${category}`);
  revalidatePath("/app", "layout");
  revalidatePath("/app/drill");

  return { score, correct, total, enqueued };
}
