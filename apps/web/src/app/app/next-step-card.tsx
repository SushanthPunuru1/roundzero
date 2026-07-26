// The shared "next step" affordance — a single-click track step with its
// plain-language reason. Used by the dashboard "Next up" hero AND inline on
// every completion surface (lesson check, quiz, drill, lab debrief) so a
// finished task points forward instead of dumping to an index.
//
// Client-safe: it takes a fully-resolved, serializable NextStepView (href
// already computed server-side) and imports only TYPES from @roundzero/db, so
// it never pulls Prisma into a client bundle when a "use client" surface
// renders it (the DECISIONS 034/036 concern). It is a plain presentational
// component — no hooks, no directive — so it renders correctly in both server
// and client parents. An app-level composition of packages/ui tokens, not a
// new primitive (DESIGN.md rule 3, signed off).

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
import { cn } from "@roundzero/ui";

export interface NextStepView {
  kind: TrackStepKind;
  title: string;
  reason: string;
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

const KIND_LABEL: Record<TrackStepKind, string> = {
  lesson: "Lesson",
  drill: "Drill",
  quiz: "Quiz",
  subnetting: "Trainer",
  checklist: "Checklist",
  lab: "Lab",
};

export function NextStepCard({
  step,
  className,
}: {
  step: NextStepView;
  className?: string;
}) {
  const Icon = ICON_BY_KIND[step.kind];
  const runnable = step.status === "available-when-runnable";

  return (
    <Link
      href={step.href}
      className={cn(
        "group flex items-center gap-4 rounded-md border border-hairline bg-surface px-4 py-4 transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2">
        <Icon className="size-5 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.06em] text-text-dim">
            {KIND_LABEL[step.kind]}
          </span>
          {runnable && (
            <span className="rounded-[3px] border border-hairline px-1.5 py-0.5 text-[11px] text-text-dim">
              Runs locally
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-sm font-medium text-text">{step.title}</span>
        <span className="mt-0.5 block text-sm text-text-dim">{step.reason}</span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-text-dim transition-transform duration-150 group-hover:translate-x-0.5"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </Link>
  );
}

/** A compact single-line variant for inline "Next up" strips after a task. */
export function NextStepInline({ step }: { step: NextStepView }) {
  return (
    <div className="rounded-md border border-hairline bg-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.06em] text-text-dim">Next up</p>
      <div className="mt-2">
        <NextStepCard step={step} />
      </div>
    </div>
  );
}
