// Prisma glue for the coach setup wizard — split out of lib/season-plan.ts
// (which stays framework-free) because season-plan.ts's pure constants
// (EVENT_KIND_LABELS etc.) are imported by a "use client" component
// (app/app/team/setup/cadence-form.tsx). Pulling `prisma` into that module
// would drag @prisma/client's Node-only code (node:fs) into the client
// bundle and fail the build. Same split as lib/track.ts vs. its pure
// generator in packages/db, just within apps/web since this logic is
// wizard-specific rather than shared.

import { prisma, type EventKind } from "@roundzero/db";

import {
  daysUntil,
  derivePlan,
  nextEventFrom,
  normalizeStep,
  resolveTeamCalendar,
  type ChecklistPlanView,
  type SeasonEventRow,
  type SetupStep,
  type TeamPlanView,
} from "./season-plan";
import type { MeetingCadence, Weekday } from "@roundzero/db";

export interface SetupState {
  organizationId: string | null;
  organizationName: string | null;
  joinCode: string | null;
  role: string | null;
  memberCount: number;
  meetingCadence: MeetingCadence | null;
  meetingDay: Weekday | null;
  seasonId: string | null;
  calendar: Map<EventKind, SeasonEventRow>;
  step: SetupStep;
}

/** Loads everything needed to render the wizard and resolve its step for one
 * user. `requestedStep` is the raw `?step=` query value (already parsed to a
 * number, or null when absent/invalid) — see `normalizeStep`. */
export async function loadSetupState(userId: string, requestedStep: number | null): Promise<SetupState> {
  const membership = await prisma.member.findFirst({
    where: { userId },
    include: { organization: true },
  });

  if (!membership) {
    return {
      organizationId: null,
      organizationName: null,
      joinCode: null,
      role: null,
      memberCount: 0,
      meetingCadence: null,
      meetingDay: null,
      seasonId: null,
      calendar: new Map(),
      step: normalizeStep(requestedStep, {
        hasTeam: false,
        memberCount: 0,
        hasCadence: false,
        hasAnyDate: false,
      }),
    };
  }

  const org = membership.organization;
  const [memberCount, eventRows] = await Promise.all([
    prisma.member.count({ where: { organizationId: org.id } }),
    org.seasonId
      ? prisma.seasonEvent.findMany({
          where: { seasonId: org.seasonId, OR: [{ organizationId: null }, { organizationId: org.id }] },
          orderBy: { startsAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const calendar = resolveTeamCalendar(eventRows, org.id);

  return {
    organizationId: org.id,
    organizationName: org.name,
    joinCode: org.joinCode,
    role: membership.role,
    memberCount,
    meetingCadence: org.meetingCadence,
    meetingDay: org.meetingDay,
    seasonId: org.seasonId,
    calendar,
    step: normalizeStep(requestedStep, {
      hasTeam: true,
      memberCount,
      hasCadence: org.meetingCadence !== null,
      hasAnyDate: calendar.size > 0,
    }),
  };
}

/** Loads the step-4 plan for a team already resolved by `loadSetupState` —
 * takes its `calendar` rather than re-querying SeasonEvent. */
export async function loadTeamPlan(
  organizationId: string,
  calendar: Map<EventKind, SeasonEventRow>,
  now: Date = new Date(),
): Promise<{ plan: TeamPlanView; nextEvent: (SeasonEventRow & { daysUntil: number }) | null }> {
  const members = await prisma.member.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  const memberIds = members.map((m) => m.userId);

  const [lessons, progress, cardsInRotation, cardsTotal, templates, forks] = await Promise.all([
    prisma.lesson.findMany({ where: { published: true }, select: { domainId: true, slug: true } }),
    prisma.lessonProgress.findMany({
      where: { userId: { in: memberIds } },
      select: { userId: true, lessonSlug: true },
    }),
    prisma.userCardState.count({ where: { userId: { in: memberIds }, card: { active: true } } }),
    prisma.drillCard.count({ where: { active: true } }),
    prisma.checklistTemplate.findMany({ select: { id: true, title: true } }),
    prisma.teamChecklist.findMany({ where: { organizationId }, select: { sourceId: true } }),
  ]);

  const completedByMember = new Map<string, Set<string>>();
  for (const row of progress) {
    const set = completedByMember.get(row.userId) ?? new Set<string>();
    set.add(row.lessonSlug);
    completedByMember.set(row.userId, set);
  }

  const forkedSourceIds = new Set(forks.map((f) => f.sourceId));
  const checklists: ChecklistPlanView[] = templates.map((template) => ({
    id: template.id,
    title: template.title,
    forked: forkedSourceIds.has(template.id),
  }));

  const plan = derivePlan({
    lessons,
    memberIds,
    completedByMember,
    cardsInRotation,
    cardsTotal,
    checklists,
  });

  const soonest = nextEventFrom([...calendar.values()], now);
  const nextEvent = soonest ? { ...soonest, daysUntil: daysUntil(soonest.startsAt, now) } : null;

  return { plan, nextEvent };
}
