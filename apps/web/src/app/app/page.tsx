import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Compass, Users } from "lucide-react";
import { prisma } from "@roundzero/db";
import { Button, Card, Eyebrow, PageHeader, Stat, StatStrip } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { viewerFromSession } from "@/lib/auth-helpers";
import { loadTodaySummary } from "@/lib/drill";
import { loadPillarProgress, loadTrack, toStepView, topSteps, type PillarProgress } from "@/lib/track";
import { NextStepCard } from "./next-step-card";

const PILLAR_HREF: Record<string, string> = {
  foundations: "/app/lessons",
  linux: "/app/lessons",
  windows: "/app/lessons",
  networking: "/app/networking",
  forensics: "/app/forensics",
};

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const viewer = viewerFromSession(session);
  const firstName = viewer.name.trim().split(/\s+/)[0] || "there";

  const [{ steps, hasPlacement }, pillars, today, membership] = await Promise.all([
    loadTrack(session.user.id),
    loadPillarProgress(session.user.id),
    loadTodaySummary(session.user.id),
    prisma.member.findFirst({
      where: { userId: session.user.id },
      include: { organization: { select: { name: true } } },
    }),
  ]);

  const next = topSteps(steps, 3).map(toStepView);
  const currentLesson = steps.find((s) => s.kind === "lesson");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${firstName}`}
        support="Your next steps, today's practice, and where you stand across every pillar."
      />

      {!hasPlacement && <PlacementInvite />}

      {/* Next up — the single most important element for a beginner. */}
      <section>
        <Eyebrow as="h2">Next up</Eyebrow>
        <p className="mt-1 text-sm text-text-dim">
          A suggested order, not a cage — you can branch off any time.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {next.map((step, i) => (
            <NextStepCard key={`${step.kind}:${step.href}:${i}`} step={step} />
          ))}
        </div>
      </section>

      {/* Today */}
      <section>
        <Eyebrow as="h2">Today</Eyebrow>
        <StatStrip className="mt-3">
          <Stat label="Cards due" value={today.dueCount} />
          <Stat
            label="Drill streak"
            value={today.streak === 0 ? "—" : `${today.streak} day${today.streak === 1 ? "" : "s"}`}
          />
          <Stat label="Currently on" value={currentLesson ? currentLesson.title : "—"} />
        </StatStrip>
      </section>

      {/* Progress across pillars */}
      <section>
        <Eyebrow as="h2">Where you stand</Eyebrow>
        <p className="mt-1 text-sm text-text-dim">
          Honest completion across every pillar — no points, no rank.
        </p>
        <div className="mt-3 flex flex-col gap-2">
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
          className="rounded-[3px] text-sm text-text-dim underline-offset-4 hover:text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Skip and browse everything
        </Link>
      </div>
    </Card>
  );
}

function PillarRow({ pillar, href }: { pillar: PillarProgress; href: string }) {
  const { lessonsDone, lessonsTotal, label, detail } = pillar;
  const pct = lessonsTotal > 0 ? Math.round((lessonsDone / lessonsTotal) * 100) : 0;

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-md border border-hairline bg-surface px-4 py-3 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-text">{label}</span>
          <span className="font-mono text-xs tabular-nums text-text-dim">
            {lessonsTotal > 0 ? `${lessonsDone}/${lessonsTotal} lessons` : "No lessons yet"}
          </span>
        </div>
        {/* Completion meter — neutral/accent only; --score is reserved for
            real scores (DESIGN.md). */}
        {lessonsTotal > 0 && (
          <div className="mt-2 h-1 overflow-hidden rounded-[3px] bg-hairline" aria-hidden="true">
            <div className="h-full rounded-[3px] bg-accent" style={{ width: `${pct}%` }} />
          </div>
        )}
        {detail && <p className="mt-2 text-xs text-text-dim">{detail}</p>}
      </div>
      <ArrowRight
        className="size-4 shrink-0 text-text-dim transition-transform duration-150 group-hover:translate-x-0.5"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </Link>
  );
}

function TeamCard({ teamName }: { teamName: string | null }) {
  return (
    <Link
      href="/app/team"
      className="group flex items-center gap-4 rounded-md border border-hairline bg-surface px-4 py-4 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2">
        <Users className="size-5 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text">
          {teamName ? teamName : "Set up or join a team"}
        </span>
        <span className="mt-0.5 block text-sm text-text-dim">
          {teamName ? "View your roster and machine roles." : "Create a roster or join with a code from your coach."}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}

function BrowseCard() {
  return (
    <Link
      href="/app/lessons"
      className="group flex items-center gap-4 rounded-md border border-hairline bg-surface px-4 py-4 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2">
        <Compass className="size-5 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text">Browse everything</span>
        <span className="mt-0.5 block text-sm text-text-dim">
          Skip the track and explore any pillar directly.
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}
