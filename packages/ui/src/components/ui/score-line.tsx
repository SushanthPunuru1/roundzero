import * as React from "react";
import { Circle, CircleCheck, OctagonAlert } from "lucide-react";

import { cn } from "../../lib/utils";
import { Badge } from "./badge";

export type ScoreLineState = "found" | "missed" | "penalty";

export interface ScoreLineProps {
  /** found = check passed; missed = not fixed (debrief only); penalty = active deduction. */
  state: ScoreLineState;
  /** Points earned/lost. Ignored for `missed` (points-possible is shown neutrally instead). */
  points: number;
  /** Points the check is worth, shown for `missed` rows. */
  possiblePoints?: number;
  category: string;
  title: string;
  /** One-line "why" in --text-dim. */
  why?: string;
  lessonHref?: string;
  className?: string;
}

function formatPoints(state: ScoreLineState, points: number, possiblePoints?: number): string {
  if (state === "missed") {
    const worth = possiblePoints ?? points;
    return worth === 0 ? "—" : String(worth);
  }
  if (points === 0) return "—";
  const sign = state === "penalty" ? "−" : "+";
  return `${sign}${Math.abs(points)}`;
}

/**
 * The one grammar every scored item renders with, everywhere it appears
 * (live score feed, debrief, checklist cross-reference, coach drill-down).
 * See DESIGN.md "Signature component: ScoreLine". Prop-driven only — no
 * scoring logic lives here.
 */
function ScoreLine({
  state,
  points,
  possiblePoints,
  category,
  title,
  why,
  lessonHref,
  className,
}: ScoreLineProps) {
  const Icon = state === "found" ? CircleCheck : state === "penalty" ? OctagonAlert : Circle;
  const pointsTone =
    state === "found" ? "text-score" : state === "penalty" ? "text-penalty" : "text-text-dim";
  const iconTone =
    state === "found" ? "text-score" : state === "penalty" ? "text-penalty" : "text-text-dim";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md px-3 py-2.5",
        state === "penalty" && "bg-penalty/[0.06]",
        state === "missed" && "opacity-100",
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconTone)} strokeWidth={1.75} aria-hidden="true" />
      <span
        className={cn(
          "w-12 shrink-0 font-mono text-sm tabular-nums",
          pointsTone,
        )}
      >
        {formatPoints(state, points, possiblePoints)}
      </span>
      <Badge className="mt-0.5 shrink-0">{category}</Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text">{title}</p>
        {why && <p className="mt-0.5 text-[13px] leading-[18px] text-text-dim">{why}</p>}
      </div>
      {lessonHref && (
        <a
          href={lessonHref}
          className="mt-0.5 shrink-0 whitespace-nowrap text-sm text-accent underline underline-offset-2 hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Lesson &rarr;
        </a>
      )}
    </div>
  );
}

export { ScoreLine };
