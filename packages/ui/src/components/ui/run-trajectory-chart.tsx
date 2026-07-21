"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import { cn } from "../../lib/utils";

export interface TrajectoryPoint {
  elapsedMs: number;
  totalEarned: number;
  /** Check ids that newly passed as of this snapshot (empty for the synthetic
   * launch point at elapsedMs 0). Drives chart<->event-row hover/focus sync. */
  newlyFoundIds: string[];
}

export interface RunTrajectoryChartProps {
  points: TrajectoryPoint[];
  totalPossible: number;
  /** Check ids currently highlighted (e.g. a hovered/focused ScoreLine row).
   * The chart echoes this; it never originates keyboard navigation itself. */
  activeCheckIds?: string[];
  onActiveCheckIdsChange?: (ids: string[]) => void;
  className?: string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function CustomTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]!.payload as TrajectoryPoint;
  return (
    <div className="rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-xs shadow-[0_8px_24px_rgb(0_0_0_/_0.4)]">
      <p className="font-mono tabular-nums text-text">{point.totalEarned} pts</p>
      <p className="font-mono tabular-nums text-text-dim">{formatElapsed(point.elapsedMs)}</p>
    </div>
  );
}

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: TrajectoryPoint;
}

type MarkerKind = "found" | "start" | "rescore";

/** Every snapshot gets a marker, not just ones that moved the score — the
 * flight recorder should show the whole run, including "scored again,
 * nothing changed" and the 0-point launch. */
function markerKind(point: TrajectoryPoint, index: number): MarkerKind {
  if (point.newlyFoundIds.length > 0) return "found";
  if (index === 0) return "start";
  return "rescore";
}

function makeDot(
  activeCheckIds: string[],
  onActiveCheckIdsChange: ((ids: string[]) => void) | undefined,
) {
  function Dot({ cx, cy, index, payload }: DotProps) {
    if (cx === undefined || cy === undefined || index === undefined || !payload) return null;
    const kind = markerKind(payload, index);
    const isActive = kind === "found" && payload.newlyFoundIds.some((id) => activeCheckIds.includes(id));
    const radius = isActive ? 5 : kind === "found" ? 3.5 : 2.5;
    const fill = isActive ? "var(--accent)" : kind === "found" ? "var(--score)" : "var(--text-dim)";
    return (
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={fill}
        fillOpacity={kind === "rescore" ? 0.6 : 1}
        stroke="var(--bg)"
        strokeWidth={1.5}
        onMouseEnter={kind === "found" ? () => onActiveCheckIdsChange?.(payload.newlyFoundIds) : undefined}
        onMouseLeave={kind === "found" ? () => onActiveCheckIdsChange?.([]) : undefined}
      />
    );
  }
  return Dot;
}

/**
 * THE signature element (DECISIONS 013 "flight recorder"): points earned
 * over elapsed time, stepping up at each found item, with a low-opacity
 * --score fill under the climb so progress carries the visual weight
 * instead of a bare line in mostly-empty space. Enhancement only — the
 * ScoreLine list below is the at-rest source of truth; this chart is
 * decorative to assistive tech (`aria-hidden`, paired with a plain-text
 * caption) and never the only way to read the run. No entrance animation:
 * DESIGN.md reserves the one expressive motion for the score count-up, and
 * this also happens to make prefers-reduced-motion a no-op here for free.
 */
function RunTrajectoryChart({
  points,
  totalPossible,
  activeCheckIds = [],
  onActiveCheckIdsChange,
  className,
}: RunTrajectoryChartProps) {
  const finalEarned = points.at(-1)?.totalEarned ?? 0;
  const finalElapsed = points.at(-1)?.elapsedMs ?? 0;
  const caption = `Score trajectory: ${finalEarned} of ${totalPossible} points reached over ${formatElapsed(finalElapsed)}.`;
  const Dot = React.useMemo(
    () => makeDot(activeCheckIds, onActiveCheckIdsChange),
    [activeCheckIds, onActiveCheckIdsChange],
  );

  return (
    <figure className={cn("m-0", className)}>
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="h-[220px] w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            accessibilityLayer={false}
          >
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis
              dataKey="elapsedMs"
              type="number"
              domain={[0, "dataMax"]}
              tickFormatter={formatElapsed}
              tick={{ fill: "var(--text-dim)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "var(--hairline)" }}
              tickLine={{ stroke: "var(--hairline)" }}
            />
            <YAxis
              dataKey="totalEarned"
              // Auto-range to the run itself (25% headroom above its own
              // max, floored so a flat-zero run still breathes) rather than
              // always spanning the full 0-totalPossible — a typical low-
              // scoring run used to leave ~3/4 of the chart empty. Never
              // exceeds totalPossible: a near-complete run still uses the
              // full range, unchanged from before.
              domain={[0, (dataMax: number) => Math.min(totalPossible, Math.max(Math.ceil(dataMax * 1.25), 10))]}
              tick={{ fill: "var(--text-dim)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "var(--hairline)" }}
              tickLine={{ stroke: "var(--hairline)" }}
              width={32}
            />
            <ReferenceLine
              y={totalPossible}
              stroke="var(--text-dim)"
              strokeDasharray="3 3"
              // "hidden", not "extendDomain": the line only renders when the
              // run's own auto-ranged domain naturally reaches it (a
              // near-full run) — it must never force the axis to stretch to
              // 100 for a low-scoring run, which was the actual bug.
              ifOverflow="hidden"
            />
            <Tooltip content={(props) => <CustomTooltip {...props} />} cursor={{ stroke: "var(--hairline)" }} />
            <Area
              type="stepAfter"
              dataKey="totalEarned"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="var(--score)"
              fillOpacity={0.12}
              dot={(props) => <Dot {...props} />}
              activeDot={{
                r: 5,
                fill: "var(--accent)",
                stroke: "var(--bg)",
                strokeWidth: 1.5,
              }}
              isAnimationActive={!prefersReducedMotion()}
              animationDuration={400}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export { RunTrajectoryChart, formatElapsed };
