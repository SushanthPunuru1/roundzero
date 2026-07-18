"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bestScore, gradeCheck, prisma } from "@roundzero/db";

import { auth } from "@/lib/auth";
import { loadLessonBySlug } from "@/lib/lesson-content";
import { enqueueLessonCards } from "@/lib/drill";

export interface CheckResultQuestion {
  correct: boolean;
  why: string;
}

export interface CheckActionState {
  error?: string;
  result?: {
    score: number;
    questions: CheckResultQuestion[];
  };
}

const submitSchema = z.object({ slug: z.string().min(1) });

const GENERIC_ERROR = "Something went wrong grading your answers. Try again.";

export async function submitCheck(
  _prevState: CheckActionState,
  formData: FormData,
): Promise<CheckActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const parsedInput = submitSchema.safeParse({ slug: formData.get("slug") });
  if (!parsedInput.success) {
    return { error: GENERIC_ERROR };
  }

  // Re-read and re-parse the MDX server-side rather than trusting the
  // client with the answer key — the grade key never crosses to the client.
  const lesson = loadLessonBySlug(parsedInput.data.slug);
  if (!lesson || !lesson.meta.published) {
    return { error: "This lesson isn't available right now." };
  }

  const total = lesson.meta.check.length;
  const answers: number[] = [];
  for (let index = 0; index < total; index += 1) {
    const raw = formData.get(`q${index}`);
    const value = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isInteger(value)) {
      return { error: "Answer every question before submitting." };
    }
    answers.push(value);
  }

  const graded = gradeCheck(lesson.meta.check, answers);

  const existing = await prisma.lessonProgress.findUnique({
    where: { userId_lessonSlug: { userId: session.user.id, lessonSlug: lesson.meta.slug } },
  });

  await prisma.lessonProgress.upsert({
    where: { userId_lessonSlug: { userId: session.user.id, lessonSlug: lesson.meta.slug } },
    create: {
      userId: session.user.id,
      lessonSlug: lesson.meta.slug,
      checkScore: graded.score,
    },
    update: {
      completedAt: new Date(),
      checkScore: bestScore(existing?.checkScore, graded.score),
    },
  });

  await enqueueLessonCards(session.user.id, lesson.meta.slug, new Date());

  revalidatePath(`/app/lessons/${lesson.meta.slug}`);
  revalidatePath("/app/lessons");
  revalidatePath("/app/drill");

  return {
    result: {
      score: graded.score,
      questions: graded.results.map((correct, index) => ({
        correct,
        why: lesson.meta.check[index]!.why,
      })),
    },
  };
}
