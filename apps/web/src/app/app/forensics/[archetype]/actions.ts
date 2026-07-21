"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FORENSICS_ARCHETYPES, bestScore, gradeAnswer, prisma } from "@roundzero/db";
import type { FormatDiff, ForensicsGradeStatus } from "@roundzero/db";

import { auth } from "@/lib/auth";
import { findForensicsQuestion, loadForensicsSet } from "@/lib/forensics-content";
import { enqueueSkillNodeCards } from "@/lib/drill";

export interface GradeForensicsResult {
  error?: string;
  status?: ForensicsGradeStatus;
  diff?: FormatDiff;
  answer?: string;
  technique?: string;
  why?: string;
}

const GENERIC_ERROR = "Something went wrong grading that answer. Try again.";

const gradeSchema = z.object({
  questionId: z.string().min(1),
  submitted: z.string(),
});

/**
 * Grades a single question for immediate feedback. Never persists anything —
 * completeForensicsSet re-grades authoritatively from the same content YAML
 * when the set finishes, so a tampered client can't inflate its own score.
 */
export async function gradeForensicsQuestion(input: {
  questionId: string;
  submitted: string;
}): Promise<GradeForensicsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: GENERIC_ERROR };
  }

  const question = findForensicsQuestion(parsed.data.questionId);
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

export interface CompleteForensicsSetResult {
  error?: string;
  score?: number;
  correct?: number;
  total?: number;
  enqueued?: number;
}

const completeSchema = z.object({
  archetypeKey: z.string().min(1),
  answers: z.array(z.object({ questionId: z.string().min(1), submitted: z.string() })),
});

/**
 * Called once a set is finished. Re-grades every question authoritatively
 * from the content YAML (never trusts the client's own per-question
 * results), upserts the user's best score for the archetype, and enqueues
 * missed questions' skill nodes into the SRS drill.
 */
export async function completeForensicsSet(input: {
  archetypeKey: string;
  answers: { questionId: string; submitted: string }[];
}): Promise<CompleteForensicsSetResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: GENERIC_ERROR };
  }

  const info = FORENSICS_ARCHETYPES.find((archetype) => archetype.key === parsed.data.archetypeKey);
  const set = loadForensicsSet(parsed.data.archetypeKey);
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

  const existing = await prisma.forensicsProgress.findUnique({
    where: { userId_archetype: { userId: session.user.id, archetype: info.value } },
  });

  await prisma.forensicsProgress.upsert({
    where: { userId_archetype: { userId: session.user.id, archetype: info.value } },
    create: { userId: session.user.id, archetype: info.value, bestScore: score },
    update: { bestScore: bestScore(existing?.bestScore, score) },
  });

  const enqueued = await enqueueSkillNodeCards(session.user.id, missedSkillNodeIds, new Date());

  revalidatePath("/app/forensics");
  revalidatePath(`/app/forensics/${parsed.data.archetypeKey}`);
  revalidatePath("/app", "layout");
  revalidatePath("/app/drill");

  return { score, correct, total, enqueued };
}
