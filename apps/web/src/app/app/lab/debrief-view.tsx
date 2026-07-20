"use client";

import * as React from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import {
  Button,
  CountUp,
  RunTrajectoryChart,
  ScoreLine,
  Stat,
  StatStrip,
  cn,
  formatElapsed,
  type TrajectoryPoint,
} from "@roundzero/ui";

import { enqueueMissedDrills } from "./actions";
import type { ScoreRow } from "./actions";

export interface ScoreSnapshot {
  elapsedMs: number;
  totalEarned: number;
  totalPossible: number;
  passedIds: string[];
}

export interface DebriefViewProps {
  imageName: string;
  mode: string;
  history: ScoreSnapshot[];
  rows: ScoreRow[];
  onRetry: () => void;
  onBack: () => void;
  retrying?: boolean;
}

function chartPointsFrom(history: ScoreSnapshot[]): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  if (history[0] && history[0].elapsedMs > 0) {
    points.push({ elapsedMs: 0, totalEarned: 0, newlyFoundIds: [] });
  }
  let prevPassed = new Set<string>();
  for (const snapshot of history) {
    const passed = new Set(snapshot.passedIds);
    const newlyFoundIds = snapshot.passedIds.filter((id) => !prevPassed.has(id));
    points.push({ elapsedMs: snapshot.elapsedMs, totalEarned: snapshot.totalEarned, newlyFoundIds });
    prevPassed = passed;
  }
  return points;
}

/**
 * The flight-recorder debrief (DECISIONS 010/013): a run's final score,
 * gauge strip, trajectory chart, and scored-item list. The chart and
 * count-up are enhancement only — every number here also lives in the
 * ScoreLine list or the gauge strip, both plain DOM, correct with motion or
 * JS effects disabled.
 */
export function DebriefView({ imageName, mode, history, rows, onRetry, onBack, retrying }: DebriefViewProps) {
  const latest = history.at(-1);
  const finalEarned = latest?.totalEarned ?? 0;
  const totalPossible = latest?.totalPossible ?? 0;
  const bestEarned = Math.max(finalEarned, ...history.map((h) => h.totalEarned));
  const elapsedMs = latest?.elapsedMs ?? 0;

  const foundCount = rows.filter((r) => r.state === "found").length;
  const penaltyRows = rows.filter((r) => r.state === "penalty");
  const missedRows = rows.filter((r) => r.state === "missed");
  const penaltyPoints = penaltyRows.reduce((sum, r) => sum + Math.abs(r.points), 0);
  const percent = totalPossible > 0 ? Math.round((finalEarned / totalPossible) * 100) : null;

  const chartPoints = React.useMemo(() => chartPointsFrom(history), [history]);
  const [activeIds, setActiveIds] = React.useState<string[]>([]);

  const [enqueuedCount, setEnqueuedCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    const missedSkillNodeIds = rows.filter((r) => r.state === "missed").map((r) => r.skillNode);
    if (missedSkillNodeIds.length === 0) {
      setEnqueuedCount(0);
      return;
    }
    let cancelled = false;
    void enqueueMissedDrills(missedSkillNodeIds).then((result) => {
      if (!cancelled) setEnqueuedCount(result.enqueuedCount);
    });
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const footerText =
    missedRows.length === 0
      ? "All objectives found — nothing missed this run."
      : enqueuedCount
        ? `${missedRows.length} missed item${missedRows.length === 1 ? "" : "s"} — ${enqueuedCount} added to your daily drill.`
        : `${missedRows.length} missed item${missedRows.length === 1 ? "" : "s"}.`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.06em] text-text-dim">Debrief</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-mono text-[25px] font-semibold leading-[32px] text-text">{imageName}</h2>
          <span className="text-sm text-text-dim">{mode}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <CountUp value={finalEarned} className="text-[32px] font-semibold leading-[40px] text-text" />
          <span className="font-mono text-lg text-text-dim">/ {totalPossible}</span>
          {bestEarned > finalEarned && (
            <span className="text-xs text-text-dim">(best this run: {bestEarned})</span>
          )}
          <span className="ml-1 font-mono text-sm tabular-nums text-text-dim">
            {formatElapsed(elapsedMs)} elapsed
          </span>
        </div>
      </div>

      <StatStrip>
        <Stat label="Score" value={percent === null ? "—" : `${percent}%`} />
        <Stat label="Objectives" value={`${foundCount} / ${rows.length}`} />
        <Stat label="Points" value={`${finalEarned} / ${totalPossible}`} />
        {penaltyRows.length > 0 && (
          <Stat label="Penalties" value={`−${penaltyPoints} (${penaltyRows.length})`} />
        )}
      </StatStrip>

      <div className="rounded-md border border-hairline bg-surface p-4">
        <div className="mb-3 text-[11px] uppercase tracking-[0.06em] text-text-dim">Run trajectory</div>
        <RunTrajectoryChart
          points={chartPoints}
          totalPossible={totalPossible}
          activeCheckIds={activeIds}
          onActiveCheckIdsChange={setActiveIds}
        />
      </div>

      <div className="flex flex-col divide-y divide-hairline border-y border-hairline">
        {rows.map((row) => (
          <div
            key={row.id}
            onMouseEnter={() => setActiveIds([row.id])}
            onMouseLeave={() => setActiveIds([])}
            className={cn(
              "transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
              activeIds.includes(row.id) && "bg-surface-2",
            )}
          >
            <ScoreLine
              state={row.state}
              points={row.points}
              possiblePoints={row.possiblePoints}
              category={row.category}
              title={row.title}
              why={row.why}
              lessonHref={row.lessonHref}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-dim">{footerText}</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Back to lab
          </Button>
          <Button variant="ghost" onClick={onRetry} disabled={retrying}>
            <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {retrying ? "Restarting…" : "Retry"}
          </Button>
        </div>
      </div>
    </div>
  );
}
