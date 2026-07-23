"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  earlyExitLevels,
  nextPlacementStep,
  prisma,
  recordPlacementAnswer,
  type PlacementAnswer,
} from "@roundzero/db";

import { auth } from "@/lib/auth";
import { loadPlacementBank } from "@/lib/placement-content";

const GENERIC_ERROR = "Something went wrong. Try again.";

const EXPERIENCE_VALUES = ["new", "some", "competed"] as const;
const FOCUS_VALUES = ["windows", "linux", "cisco", "unsure"] as const;

const answerSchema = z.object({
  questionId: z.string().min(1),
  choice: z.number().int().min(-1),
});

const advanceSchema = z.object({
  experience: z.enum(EXPERIENCE_VALUES),
  focus: z.array(z.enum(FOCUS_VALUES)).min(1),
  answers: z.array(answerSchema).max(50),
  endEarly: z.boolean().optional(),
});

export interface AdvancePlacementResult {
  error?: string;
  done?: boolean;
  question?: { id: string; domain: string; tier: string; prompt: string; options: string[] };
  offerEarlyExit?: boolean;
  levels?: Record<string, string>;
}

/**
 * Re-grades the ENTIRE answer history from the content-as-code bank on every
 * call — never trusts a client-reported domain/tier/correctness (only
 * questionId + choice), the same discipline lesson checks / forensics / quiz
 * grading use. Stateless server-side: the client holds the running answer
 * list and resubmits it each step (DECISIONS 034's re-derive-from-input
 * pattern), so there's no in-progress-placement row to manage.
 */
export async function advancePlacement(input: unknown): Promise<AdvancePlacementResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const parsed = advanceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: GENERIC_ERROR };
  }
  const { experience, focus, answers, endEarly } = parsed.data;

  const bank = loadPlacementBank();
  let history: PlacementAnswer[];
  try {
    history = answers.map((answer) => recordPlacementAnswer(bank, answer.questionId, answer.choice));
  } catch {
    return { error: GENERIC_ERROR };
  }

  const step = endEarly ? { done: true as const, levels: earlyExitLevels() } : nextPlacementStep(history, bank);

  if (step.done) {
    // Prisma's Json input type wants plain objects with a string index
    // signature; PlacementAnswer is a nominal interface, so a structural
    // cast is needed even though every field is already JSON-safe.
    const jsonHistory = history as unknown as Record<string, string | number | boolean>[];

    await prisma.placement.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        experience,
        focus,
        levels: step.levels,
        answers: jsonHistory,
      },
      update: {
        completedAt: new Date(),
        experience,
        focus,
        levels: step.levels,
        answers: jsonHistory,
      },
    });
    revalidatePath("/app/placement");
    return { done: true, levels: step.levels };
  }

  return { done: false, question: step.question, offerEarlyExit: step.offerEarlyExit };
}

/** Deletes the user's placement so they can retake it — placement is
 * always re-takeable, per ONBOARDING_PATH_SPEC.md Part A. */
export async function resetPlacement(): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  await prisma.placement.deleteMany({ where: { userId: session.user.id } });
  revalidatePath("/app/placement");
  return {};
}
