"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, scheduleReview, type CardState } from "@roundzero/db";

import { auth } from "@/lib/auth";

export interface RateCardResult {
  error?: string;
}

const rateSchema = z.object({
  stateId: z.string().min(1),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

const GENERIC_ERROR = "Something went wrong recording that review. Try again.";

/**
 * Applies a rating to one card review: schedules the next state via ts-fsrs
 * (packages/db/src/srs/schedule.ts — never hand-rolled here) and appends a
 * ReviewLog row, in a transaction.
 */
export async function rateCard(input: {
  stateId: string;
  rating: number;
}): Promise<RateCardResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const parsed = rateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: GENERIC_ERROR };
  }

  const state = await prisma.userCardState.findUnique({ where: { id: parsed.data.stateId } });
  if (!state || state.userId !== session.user.id) {
    return { error: GENERIC_ERROR };
  }

  const now = new Date();
  const current: CardState = {
    due: state.due,
    stability: state.stability,
    difficulty: state.difficulty,
    elapsedDays: state.elapsedDays,
    scheduledDays: state.scheduledDays,
    learningSteps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    lastReview: state.lastReview,
  };

  const next = scheduleReview(current, parsed.data.rating, now);

  await prisma.$transaction([
    prisma.userCardState.update({
      where: { id: state.id },
      data: {
        due: next.due,
        stability: next.stability,
        difficulty: next.difficulty,
        elapsedDays: next.elapsedDays,
        scheduledDays: next.scheduledDays,
        learningSteps: next.learningSteps,
        reps: next.reps,
        lapses: next.lapses,
        state: next.state,
        lastReview: next.lastReview,
      },
    }),
    prisma.reviewLog.create({
      data: {
        userId: session.user.id,
        cardId: state.cardId,
        rating: parsed.data.rating,
        reviewedAt: now,
      },
    }),
  ]);

  revalidatePath("/app/drill");

  return {};
}
