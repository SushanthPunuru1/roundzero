import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@roundzero/db";
import { PageHeader } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { SubnettingTrainer } from "./subnetting-trainer";
import { recordQuickRound } from "./actions";

const QUIZ_ID = "subnetting";
const QUICK_ROUND_CATEGORY = "quick-round";

export default async function SubnettingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const progress = await prisma.quizProgress.findUnique({
    where: {
      userId_quizId_category: {
        userId: session.user.id,
        quizId: QUIZ_ID,
        category: QUICK_ROUND_CATEGORY,
      },
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Training"
        title="Subnetting"
        support="Generative subnetting practice — CIDR/mask breakdowns, VLSM fits, and network lookups, with the full worked binary solution on every problem. Subnetting is a skill drilled by volume, not memorized."
      />
      <SubnettingTrainer
        bestAccuracy={progress?.bestScore ?? null}
        recordQuickRound={recordQuickRound}
      />
    </div>
  );
}
