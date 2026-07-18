// DB glue for the daily drill (Milestone 3). Pure scheduling/selection logic
// lives in @roundzero/db (packages/db/src/srs) — this module is only the
// Prisma queries and the shape apps/web's server components/actions need.

import {
  CardType,
  DAILY_NEW_CARD_CAP,
  PLATFORM_TIME_ZONE,
  computeStreak,
  dueCards,
  localDateKey,
  newCardState,
  prisma,
  selectNewFoundationsCards,
} from "@roundzero/db";

function freshStateRow(userId: string, cardId: string, now: Date) {
  const fresh = newCardState(now);
  return {
    userId,
    cardId,
    due: fresh.due,
    stability: fresh.stability,
    difficulty: fresh.difficulty,
    elapsedDays: fresh.elapsedDays,
    scheduledDays: fresh.scheduledDays,
    learningSteps: fresh.learningSteps,
    reps: fresh.reps,
    lapses: fresh.lapses,
    state: fresh.state,
    lastReview: fresh.lastReview,
  };
}

/**
 * Enqueues a completed lesson's cards for the user: every active DrillCard
 * whose skillNodeId belongs to this lesson, that the user doesn't already
 * have a UserCardState for. Not subject to the daily new-card cap —
 * completing a lesson should surface its cards right away. Safe to call on
 * every completion (including retakes): the unique (userId, cardId)
 * constraint makes it idempotent via skipDuplicates.
 */
export async function enqueueLessonCards(
  userId: string,
  lessonSlug: string,
  now: Date,
): Promise<void> {
  const skills = await prisma.lessonSkill.findMany({
    where: { lessonSlug },
    select: { skillNodeId: true },
  });
  if (skills.length === 0) return;

  const cards = await prisma.drillCard.findMany({
    where: { active: true, skillNodeId: { in: skills.map((s) => s.skillNodeId) } },
    select: { id: true },
  });
  if (cards.length === 0) return;

  await prisma.userCardState.createMany({
    data: cards.map((card) => freshStateRow(userId, card.id, now)),
    skipDuplicates: true,
  });
}

/**
 * Tops up today's Foundations new-card batch, capped at DAILY_NEW_CARD_CAP
 * per local day (PLATFORM_TIME_ZONE). Idempotent within a day: re-running
 * mid-session introduces nothing further once the cap is met.
 */
async function topUpFoundationsBatch(userId: string, now: Date): Promise<void> {
  const [allActiveCards, inRotation, recentlyCreated] = await Promise.all([
    prisma.drillCard.findMany({
      where: { active: true },
      select: { id: true, skillNodeId: true },
    }),
    prisma.userCardState.findMany({ where: { userId }, select: { cardId: true } }),
    // Over-fetch a generous window (comfortably covers any timezone offset)
    // rather than computing a UTC day-boundary — the actual "is this today"
    // check happens below via localDateKey, a pure/testable comparison.
    prisma.userCardState.findMany({
      where: { userId, createdAt: { gte: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) } },
      select: { createdAt: true },
    }),
  ]);

  const todayKey = localDateKey(now, PLATFORM_TIME_ZONE);
  const introducedToday = recentlyCreated.filter(
    (row) => localDateKey(row.createdAt, PLATFORM_TIME_ZONE) === todayKey,
  ).length;

  const toIntroduce = selectNewFoundationsCards(
    allActiveCards,
    new Set(inRotation.map((s) => s.cardId)),
    introducedToday,
    DAILY_NEW_CARD_CAP,
  );
  if (toIntroduce.length === 0) return;

  await prisma.userCardState.createMany({
    data: toIntroduce.map((cardId) => freshStateRow(userId, cardId, now)),
    skipDuplicates: true,
  });
}

export interface DrillCardView {
  stateId: string;
  cardId: string;
  type: CardType;
  front: string;
  back: string;
}

export interface DrillData {
  queue: DrillCardView[];
  dueCount: number;
  streak: number;
}

/** Loads the full daily drill: tops up new cards, then returns the due queue,
 * due count, and current streak. */
export async function loadDrill(userId: string, now: Date = new Date()): Promise<DrillData> {
  await topUpFoundationsBatch(userId, now);

  const [states, reviewLogs] = await Promise.all([
    prisma.userCardState.findMany({
      where: { userId, card: { active: true } },
      include: { card: true },
    }),
    prisma.reviewLog.findMany({ where: { userId }, select: { reviewedAt: true } }),
  ]);

  const due = dueCards(states, now);
  const queue: DrillCardView[] = due.map((state) => ({
    stateId: state.id,
    cardId: state.cardId,
    type: state.card.type,
    front: state.card.front,
    back: state.card.back,
  }));

  const streak = computeStreak(
    reviewLogs.map((row) => row.reviewedAt),
    now,
    PLATFORM_TIME_ZONE,
  );

  return { queue, dueCount: queue.length, streak };
}

/** Cheap due-count query for the nav badge — does not top up new cards (that
 * only happens when the drill page itself loads). */
export async function countDueCards(userId: string, now: Date = new Date()): Promise<number> {
  return prisma.userCardState.count({
    where: { userId, due: { lte: now }, card: { active: true } },
  });
}
