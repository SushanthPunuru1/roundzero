// The shared "next step" affordance — a track step with its plain-language
// reason. Used by the dashboard "Next up" hero AND inline on every completion
// surface (lesson check, quiz, drill, lab debrief) so a finished task points
// forward instead of dumping to an index.
//
// Client-safe: it takes a fully-resolved, serializable NextStepView (href
// already computed server-side) and imports only TYPES from @roundzero/db, so
// it never pulls Prisma into a client bundle when a "use client" surface
// renders it (the DECISIONS 034/036 concern). It is a plain presentational
// component — no hooks, no directive — so it renders correctly in both server
// and client parents. An app-level composition of packages/ui tokens, not a
// new primitive (DESIGN.md rule 3, signed off).
//
// DECISIONS 038 reshaped this from one card rendered N times into a
// deliberate hierarchy, because three equal cards read as three choices when
// they are actually one sequence:
//   NextStepHero  — step 1. Dominant, with a real primary action.
//   NextStepRow   — steps 2+. Compact, ordinal-marked, clearly "after this".
// Both carry pillar + time cost in the eyebrow; the kind is already legible
// from the icon, so spending the eyebrow on "LESSON" was wasted.

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Calculator,
  ClipboardCheck,
  ListChecks,
  type LucideIcon,
  Terminal,
} from "lucide-react";
import type { TrackStepKind, TrackStepStatus } from "@roundzero/db";
import { Button, Eyebrow, cn } from "@roundzero/ui";

export interface NextStepView {
  kind: TrackStepKind;
  title: string;
  reason: string;
  /** Pillar label for the eyebrow ("Foundations", "Networking"). */
  pillar: string;
  /** Honest time cost where one exists; null where it would be invented. */
  minutes: number | null;
  href: string;
  status: TrackStepStatus;
}

const ICON_BY_KIND: Record<TrackStepKind, LucideIcon> = {
  lesson: BookOpen,
  drill: Brain,
  quiz: ListChecks,
  subnetting: Calculator,
  checklist: ClipboardCheck,
  lab: Terminal,
};

/** The verb on the hero's primary action. Buttons say what happens
 * (DESIGN.md interface writing), so no step says "Continue". */
const ACTION_BY_KIND: Record<TrackStepKind, string> = {
  lesson: "Start lesson",
  drill: "Start drill",
  quiz: "Start quiz",
  subnetting: "Open trainer",
  checklist: "Open checklist",
  lab: "Open lab",
};

const INTERACTIVE =
  "transition-colors duration-standard ease-standard hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/** Pillar + time cost. The reason line answers "why"; this answers "what part
 * of the product, and what does it cost me right now". */
function StepMeta({ step, className }: { step: NextStepView; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Eyebrow as="span">{step.pillar}</Eyebrow>
      {step.minutes !== null && (
        <>
          <span className="text-[11px] leading-none text-text-dim" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-[11px] tabular-nums text-text-dim">{step.minutes} min</span>
        </>
      )}
    </span>
  );
}

/** Shown instead of a link/button when a step is real but can't be started
 * from this deploy. The card must not pretend to be actionable — the whole
 * point of the "available-when-runnable" status. */
function RunsLocallyNote() {
  return (
    <span className="inline-flex items-center rounded-sm border border-hairline px-2 py-1 text-[11px] text-text-dim">
      Runs locally
    </span>
  );
}

/**
 * Step 1 — the one thing to do now. Dominant by padding, type size, and a
 * real primary action rather than a trailing chevron 700px from the text.
 */
export function NextStepHero({
  step,
  muted = false,
  className,
}: {
  step: NextStepView;
  /**
   * Drop the accent border and icon tint, keeping the size and the primary
   * action. Set when something above this card is the real first thing to do
   * — today that's the placement invite, which is also accent-bordered. Two
   * accent cards stacked make neither one the answer to "what now".
   */
  muted?: boolean;
  className?: string;
}) {
  const Icon = ICON_BY_KIND[step.kind];
  const runnable = step.status === "available-when-runnable";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-md border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between",
        muted ? "border-hairline" : "border-accent/30",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2">
          <Icon
            className={cn("size-5", muted ? "text-text-dim" : "text-accent")}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </span>
        {/* Capped so the reason wraps at a readable measure instead of
            stretching to the full 1100px container. */}
        <div className="min-w-0 max-w-[62ch]">
          <StepMeta step={step} />
          <p className="mt-1 text-base font-semibold leading-6 text-text">{step.title}</p>
          <p className="mt-1 text-sm text-text-dim">{step.reason}</p>
        </div>
      </div>
      <div className="shrink-0 sm:pl-4">
        {runnable ? (
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <RunsLocallyNote />
            <Link
              href={step.href}
              className="rounded-sm text-sm text-text-dim underline-offset-4 transition-colors duration-standard ease-standard hover:text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              How to run it
            </Link>
          </div>
        ) : (
          <Button asChild>
            <Link href={step.href}>
              {ACTION_BY_KIND[step.kind]}
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Steps 2+ — deliberately quieter than the hero. The leading ordinal is the
 * sequence signal: without it, a stack of cards reads as a menu of parallel
 * choices rather than "this, then this".
 */
export function NextStepRow({
  step,
  ordinal,
  className,
}: {
  step: NextStepView;
  /** 1-based position in the queue, rendered as the sequence marker. */
  ordinal?: number;
  className?: string;
}) {
  const Icon = ICON_BY_KIND[step.kind];
  const runnable = step.status === "available-when-runnable";

  const body = (
    <>
      {ordinal !== undefined && (
        <span className="w-4 shrink-0 font-mono text-[13px] leading-5 tabular-nums text-text-dim">
          {ordinal}
        </span>
      )}
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2">
        <Icon className="size-4 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
      </span>
      {/* Deliberately NOT capped to a 62ch measure like the hero: these lines
          are single-line and truncated, so a narrow cap would ellipsis an
          authored reason mid-sentence — which would undo the whole point of
          authoring them. They get the full remaining row width; the ~110-char
          ceiling documented in the lessons README keeps them inside it. */}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-text">{step.title}</span>
        <span className="mt-1 block truncate text-sm text-text-dim">{step.reason}</span>
      </span>
      {/* Right cluster: gives the trailing arrow a neighbour instead of
          leaving it stranded at the far edge of a 1100px row. Kept at every
          width — the pillar and the time cost are the point of the eyebrow,
          so hiding them on small screens hid the information itself. */}
      <StepMeta step={step} className="shrink-0" />
      {runnable ? (
        <RunsLocallyNote />
      ) : (
        <ArrowRight
          className="size-4 shrink-0 text-text-dim transition-transform duration-standard ease-standard motion-safe:group-hover:translate-x-1"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      )}
    </>
  );

  const shell = "flex items-center gap-4 rounded-md border border-hairline bg-surface px-4 py-3";

  // A step that can't be started here is not a link. Rendering it as one is
  // the bug this replaced: the chip said "runs locally" while the whole card
  // was still a live link that dead-ends on the production deploy.
  if (runnable) {
    return <div className={cn(shell, className)}>{body}</div>;
  }

  return (
    <Link href={step.href} className={cn("group", shell, INTERACTIVE, className)}>
      {body}
    </Link>
  );
}

/**
 * Back-compat alias for the completion surfaces that render a single step.
 * They want the compact treatment, not the dashboard hero.
 */
export function NextStepCard({ step, className }: { step: NextStepView; className?: string }) {
  return <NextStepRow step={step} className={className} />;
}

/** A compact single-step strip for inline "Next up" after a finished task. */
export function NextStepInline({ step }: { step: NextStepView }) {
  return (
    <div className="rounded-md border border-hairline bg-surface p-4">
      <Eyebrow>Next up</Eyebrow>
      <div className="mt-2">
        <NextStepRow step={step} />
      </div>
    </div>
  );
}
