import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, TOTAL_QUESTIONS } from "@roundzero/db";
import { PageHeader } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { advancePlacement, resetPlacement } from "./actions";
import { PlacementFlow } from "./placement-flow";

export default async function PlacementPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const placement = await prisma.placement.findUnique({ where: { userId: session.user.id } });

  return (
    <div>
      <PageHeader
        eyebrow="Placement"
        title="Find your starting point"
        support="A short, skippable check that points you at the right place to begin — never a score, never a rank."
      />
      <PlacementFlow
        totalQuestions={TOTAL_QUESTIONS}
        initialResult={placement ? { levels: placement.levels as Record<string, string> } : null}
        onAdvance={advancePlacement}
        onReset={resetPlacement}
      />
    </div>
  );
}
