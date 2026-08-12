import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Compass, ListChecks, Users } from "lucide-react";
import { prisma } from "@roundzero/db";
import { Button, Card, EmptyState, PageHeader, SectionHeader, Stat, StatStrip } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { viewerFromSession } from "@/lib/auth-helpers";
import { loadTodaySummary } from "@/lib/drill";
import {
  loadPillarProgress,
  loadTrack,
  toStepView,
  topSteps,
  totalProgress,
  type PillarProgress,
} from "@/lib/track";
import { NextStepHero, NextStepRow } from "./next-step-card";

const PILLAR_HREF: Record<string, string> = {
  foundations: "/app/lessons",
  linux: "/app/lessons",
  windows: "/app/lessons",
  networking: "/app/networking",
  forensics: "/app/forensics",
};

// One shared interaction treatment for every clickable row on this screen, so
// hover/focus/easing can't drift apart per-component the way they had
// (three rows were missing the design system's easing entirely).
const ROW_INTERACTIVE =
  "transition-colors duration-standard ease-standard hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const viewer = viewerFromSession(session);
  const firstName = viewer.name.trim().split(/\s+/)[0] || "there";

  const [{ steps, hasPlacement }, pillars, today, membership, lastDone] = await Promise.all([
    loadTrack(session.user.id),
    loadPillarProgress(session.user.id),
    loadTodaySummary(session.user.id),
    prisma.member.findFirst({
      where: { userId: session.user.id },
      include: { organization: { select: { name: true } } },
    }),
    // "Last completed", not "currently on": the old stat showed the first
    // lesson of the track, which for a new user IS the Next up hero — the
    // same title restated a few hundred pixels below it. Looking backward is
    // both non-duplicative and the only one of the two a user can't already
    // see on this screen.
    prisma.lessonProgress.findFirst({
      where: { userId: session.user.id },
      orderBy: { completedAt: "desc" },
      select: { lessonSlug: true, lesson: { select: { title: true } } },
    }),
  ]);

  const next = topSteps(steps, 3).map(toStepView);
  const [leadStep, ...laterSteps] = next;
  const totals = totalProgress(pillars);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${firstName}`}
        support="Your next steps, today's practice, and where you stand across every pillar."
      />

      {!hasPlacement && <PlacementInvite />}

      {/* Next up — the single most important element for a beginner, and now
          shaped like it: one dominant step with a real action, the rest
          demoted and numbered so the stack reads as an order, not a menu. */}
      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Next up"
          support="A suggested order, not a cage — work top to bottom, or branch off any time."
        />
        {leadStep ? (
          <>
            <NextStepHero step={leadStep} muted={!hasPlacement} />
            {laterSteps.length > 0 && (
              <div className="flex flex-col gap-2">
                {laterSteps.map((step, i) => (
                  <NextStepRow
                    key={`${step.kind}:${step.href}`}
                    step={step}
                    ordinal={i + 2}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          // The generator is total and should never return an empty track;
          // this is the designed floor if it ever does, rather than a heading
          // followed by nothing.
          <EmptyState
            icon={Compass}
            message="No next step to suggest yet — browse the pillars and pick anything that looks useful."
            action={
              <Button asChild>
                <Link href="/app/lessons">Browse lessons</Link>
              </Button>
            }
          />
        )}
      </section>

      <TodaySection
        dueCount={today.dueCount}
        streak={today.streak}
        lastDone={lastDone ? { title: lastDone.lesson.title, slug: lastDone.lessonSlug } : null}
      />

      {/* Progress across pillars */}
      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Where you stand"
          support="Honest completion across every pillar — no points, no rank."
          aside={
            totals.total > 0 ? (
              <span className="font-mono tabular-nums text-text-dim">
                {totals.done} of {totals.total} lessons
              </span>
            ) : null
          }
        />
        <div className="flex flex-col gap-2">
          {pillars.map((pillar) => (
            <PillarRow key={pillar.domain} pillar={pillar} href={PILLAR_HREF[pillar.domain]!} />
          ))}
        </div>
      </section>

      {/* Team + browse-everything escape */}
      <section className="grid gap-2 sm:grid-cols-2">
        <TeamCard teamName={membership?.organization.name ?? null} />
        <BrowseCard />
      </section>
    </div>
  );
}

function PlacementInvite() {
  return (
    <Card className="flex flex-col gap-4 border-accent/30 bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2">
          <Compass className="size-5 text-accent" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div>
          <p className="text-base font-semibold text-text">Find your starting point</p>
          <p className="mt-1 text-sm text-text-dim">
            A ~3-minute check, so we can point you at the right place to begin. Never a score, never a rank.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Button asChild>
          <Link href="/app/placement">Start placement</Link>
        </Button>
        <Link
          href="/app/lessons"
          className={`rounded-sm text-sm text-text-dim underline-offset-4 hover:text-text hover:underline ${ROW_INTERACTIVE}`}
        >
          Skip and browse everything
        </Link>
      </div>
    </Card>
  );
}

/**
 * Today. Previously three bare stats floating with no container, two of which
 * read "0" and "—" for anyone who had just signed up — a status report of
 * failure before they had done anything. Now it sits in a card, its empty
 * values recruit instead of scoring, and "Currently on" (the likeliest thing
 * on the row to be clicked) is actually a link.
 */
function TodaySection({
  dueCount,
  streak,
  lastDone,
}: {
  dueCount: number;
  streak: number;
  lastDone: { title: string; slug: string } | null;
}) {
  const coldStart = dueCount === 0 && streak === 0;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title="Today"
        support={
          coldStart
            ? "Your first recall cards are waiting — the drill introduces them the moment you open it."
            : "Recall due now, your streak, and the last lesson you finished."
        }
        aside={
          <Link
            href="/app/drill"
            className={`inline-flex items-center gap-1 rounded-sm text-sm text-accent underline-offset-4 hover:underline ${ROW_INTERACTIVE}`}
          >
            {coldStart ? "Start your first drill" : "Open drill"}
            <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        }
      />
      <Card className="p-4">
        <StatStrip>
          <Stat
            label="Cards due"
            value={dueCount > 0 ? dueCount : "None due yet"}
            mono={dueCount > 0}
          />
          <Stat
            label="Drill streak"
            value={streak > 0 ? `${streak} day${streak === 1 ? "" : "s"}` : "Not started"}
            mono={streak > 0}
          />
          <Stat
            label="Last completed"
            mono={false}
            value={
              lastDone ? (
                <Link
                  href={`/app/lessons/${lastDone.slug}`}
                  className={`rounded-sm underline-offset-4 hover:text-accent hover:underline ${ROW_INTERACTIVE}`}
                >
                  {lastDone.title}
                </Link>
              ) : (
                "Nothing yet"
              )
            }
          />
        </StatStrip>
      </Card>
    </section>
  );
}

/**
 * A pillar's completion, as a segmented meter rather than a progress bar.
 *
 * The bar version rendered a full-width `--hairline` track behind the fill,
 * so a pillar at 0% showed a solid grey bar that read as nearly complete.
 * One tick per lesson can't be misread: nine empty ticks are visibly nine
 * things not done. It also fixes the rhythm — every row is exactly two lines
 * tall whether or not it has lessons or a detail figure, where before rows
 * without a meter were ~7px shorter and the stack jittered.
 */
function PillarRow({ pillar, href }: { pillar: PillarProgress; href: string }) {
  const { lessonsDone, lessonsTotal, label, detail } = pillar;

  return (
    <Link href={href} className={`group flex items-center gap-4 rounded-md border border-hairline bg-surface px-4 py-3 ${ROW_INTERACTIVE}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-text">{label}</span>
          <span className="shrink-0 font-mono text-[13px] leading-5 tabular-nums text-text-dim">
            {lessonsTotal > 0 ? `${lessonsDone}/${lessonsTotal} lessons` : "No lessons yet"}
            {detail && <span className="text-text-dim"> · {detail}</span>}
          </span>
        </div>
        {/* Completion meter — neutral/accent only; --score is reserved for
            real scores (DESIGN.md). Height is reserved even with no lessons
            so every row in the stack is the same height. */}
        <div className="mt-2 flex h-1 items-stretch gap-1" aria-hidden="true">
          {lessonsTotal > 0 &&
            Array.from({ length: lessonsTotal }, (_, i) => (
              <span
                key={i}
                className={`flex-1 rounded-sm ${i < lessonsDone ? "bg-accent" : "bg-hairline"}`}
              />
            ))}
        </div>
      </div>
      <ArrowRight
        className="size-4 shrink-0 text-text-dim transition-transform duration-standard ease-standard motion-safe:group-hover:translate-x-1"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </Link>
  );
}

function TeamCard({ teamName }: { teamName: string | null }) {
  return (
    <Link href="/app/team" className={`group flex items-center gap-4 rounded-md border border-hairline bg-surface px-4 py-4 ${ROW_INTERACTIVE}`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2">
        <Users className="size-5 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text">
          {teamName ? teamName : "Set up or join a team"}
        </span>
        <span className="mt-1 block text-sm text-text-dim">
          {teamName ? "View your roster and machine roles." : "Create a roster or join with a code from your coach."}
        </span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-text-dim transition-transform duration-standard ease-standard motion-safe:group-hover:translate-x-1"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </Link>
  );
}

function BrowseCard() {
  return (
    <Link href="/app/lessons" className={`group flex items-center gap-4 rounded-md border border-hairline bg-surface px-4 py-4 ${ROW_INTERACTIVE}`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2">
        <ListChecks className="size-5 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text">Browse everything</span>
        <span className="mt-1 block text-sm text-text-dim">
          Skip the track and explore any pillar directly.
        </span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-text-dim transition-transform duration-standard ease-standard motion-safe:group-hover:translate-x-1"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </Link>
  );
}
