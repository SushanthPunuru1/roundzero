"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bestScore, prisma } from "@roundzero/db";

import { auth } from "@/lib/auth";
import { generateRound, type ProblemType } from "@/lib/subnetting/generate";
import { gradeRound } from "@/lib/subnetting/grade";

// Mirrors generate.ts's PROBLEM_TYPES — kept as a literal tuple here because
// zod's enum needs one, and this is the request-boundary validation schema
// anyway (CLAUDE.md: zod validation at the boundary).
const PROBLEM_TYPE_VALUES = ["cidr-breakdown", "mask-breakdown", "vlsm-fit", "which-subnet"] as const;

const QUIZ_ID = "subnetting";
const QUICK_ROUND_CATEGORY = "quick-round";

const GENERIC_ERROR = "Something went wrong scoring that round. Try again.";

const answerSchema = z.object({
  network: z.string().optional(),
  broadcast: z.string().optional(),
  firstHost: z.string().optional(),
  lastHost: z.string().optional(),
  usableHosts: z.string().optional(),
  mask: z.string().optional(),
  cidr: z.string().optional(),
});

const recordSchema = z.object({
  seed: z.number().int(),
  count: z.number().int().min(1).max(50),
  types: z.array(z.enum(PROBLEM_TYPE_VALUES)).optional(),
  answers: z.array(answerSchema),
});

export interface RecordQuickRoundResult {
  error?: string;
  accuracy?: number;
  correct?: number;
  total?: number;
  best?: number;
}

/**
 * Re-derives the round from its seed and re-grades it authoritatively —
 * never trusts a client-reported accuracy — the same discipline
 * completeQuizSet/completeForensicsSet use (DECISIONS 031/033), even though
 * there's no secret answer key here (subnet math is derivable by anyone):
 * the point is that the persisted "best accuracy" number must always reflect
 * what was actually submitted, not whatever a tampered client claims.
 */
export async function recordQuickRound(input: {
  seed: number;
  count: number;
  types?: string[];
  answers: Record<string, string | undefined>[];
}): Promise<RecordQuickRoundResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const parsed = recordSchema.safeParse(input);
  if (!parsed.success || parsed.data.answers.length !== parsed.data.count) {
    return { error: GENERIC_ERROR };
  }

  const problems = generateRound(
    parsed.data.seed,
    parsed.data.count,
    parsed.data.types as ProblemType[] | undefined,
  );
  const { correct, total, accuracy } = gradeRound(problems, parsed.data.answers);

  const existing = await prisma.quizProgress.findUnique({
    where: {
      userId_quizId_category: {
        userId: session.user.id,
        quizId: QUIZ_ID,
        category: QUICK_ROUND_CATEGORY,
      },
    },
  });

  const updated = await prisma.quizProgress.upsert({
    where: {
      userId_quizId_category: {
        userId: session.user.id,
        quizId: QUIZ_ID,
        category: QUICK_ROUND_CATEGORY,
      },
    },
    create: { userId: session.user.id, quizId: QUIZ_ID, category: QUICK_ROUND_CATEGORY, bestScore: accuracy },
    update: { bestScore: bestScore(existing?.bestScore, accuracy) },
  });

  revalidatePath("/app/subnetting");

  return { accuracy, correct, total, best: updated.bestScore };
}
