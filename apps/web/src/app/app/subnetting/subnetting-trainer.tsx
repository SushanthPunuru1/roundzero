"use client";

// The custom interactive tool the whole Cisco pillar's Part B is about:
// a generative subnetting problem engine with per-field checking and an
// instant worked binary solution. Pure math (@/lib/subnetting/*) runs
// entirely client-side — unlike the quiz/forensics tools, there's no secret
// answer key to protect (subnet math is derivable by anyone), so nothing
// here needs a server round trip except persisting a quick round's best
// accuracy, which the server always re-derives from the round's seed rather
// than trusting the client (see actions.ts).

import { useEffect, useRef, useState } from "react";
import { CircleCheck, Circle, Play, RotateCcw, Timer as TimerIcon } from "lucide-react";
import { Button, Card, ErrorNote, Eyebrow, Input, Kbd, Select, Stat, StatStrip, formatElapsed } from "@roundzero/ui";

import {
  PROBLEM_TYPES,
  generateProblem,
  generateRound,
  makeRng,
  type Problem,
  type ProblemType,
} from "@/lib/subnetting/generate";
import { FIELDS_BY_TYPE, FIELD_LABELS, gradeProblem, type AnswerField, type GradeResult } from "@/lib/subnetting/grade";
import { explainProblem } from "@/lib/subnetting/explain";
import type { RecordQuickRoundResult } from "./actions";

const QUICK_ROUND_LENGTH = 5;

const TYPE_LABELS: Record<ProblemType, string> = {
  "cidr-breakdown": "CIDR breakdown",
  "mask-breakdown": "Mask breakdown",
  "vlsm-fit": "VLSM fit",
  "which-subnet": "Which subnet",
};

type Mode = "quick" | "endless";
type Phase = "setup" | "round" | "summary";
type FieldAnswers = Partial<Record<AnswerField, string>>;

function emptyAnswers(type: ProblemType): FieldAnswers {
  return Object.fromEntries(FIELDS_BY_TYPE[type].map((field) => [field, ""]));
}

function problemPrompt(problem: Problem): { title: string; given: string } {
  switch (problem.type) {
    case "cidr-breakdown":
      return { title: "Break down this address.", given: `${problem.ip}/${problem.prefix}` };
    case "mask-breakdown":
      return { title: "Break down this address.", given: `${problem.ip}  mask ${problem.mask}` };
    case "which-subnet":
      return { title: "Which subnet is this host in? Find its network address.", given: `${problem.ip}/${problem.prefix}` };
    case "vlsm-fit":
      return {
        title: `You need at least ${problem.requiredHosts} usable hosts in this block. Find the smallest subnet (CIDR) that fits.`,
        given: `${problem.ip}/${problem.basePrefix}`,
      };
  }
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function SubnettingTrainer({
  bestAccuracy,
  recordQuickRound,
}: {
  bestAccuracy: number | null;
  recordQuickRound: (input: {
    seed: number;
    count: number;
    types?: string[];
    answers: FieldAnswers[];
  }) => Promise<RecordQuickRoundResult>;
}) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<Mode>("quick");
  const [typeFilter, setTypeFilter] = useState<"all" | ProblemType>("all");
  const [timerOn, setTimerOn] = useState(true);

  const [problems, setProblems] = useState<Problem[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<FieldAnswers>({});
  const [feedback, setFeedback] = useState<GradeResult | null>(null);
  const collectedRef = useRef<FieldAnswers[]>([]);
  const seedRef = useRef<number | null>(null);
  const rngRef = useRef<(() => number) | null>(null);

  const [runningStats, setRunningStats] = useState({ solved: 0, correct: 0 });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ accuracy: number; correct: number; total: number; best: number } | null>(
    null,
  );

  useEffect(() => {
    if (phase !== "round" || !timerOn || startedAt === null) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => clearInterval(id);
  }, [phase, timerOn, startedAt]);

  const current = problems[index];
  const types = typeFilter === "all" ? undefined : [typeFilter];

  function start() {
    const seed = randomSeed();
    seedRef.current = seed;
    collectedRef.current = [];
    setError(null);
    setSummary(null);
    setRunningStats({ solved: 0, correct: 0 });
    setElapsedMs(0);
    setStartedAt(Date.now());
    setFeedback(null);

    if (mode === "quick") {
      const round = generateRound(seed, QUICK_ROUND_LENGTH, types);
      setProblems(round);
      setAnswers(emptyAnswers(round[0]!.type));
    } else {
      const rng = makeRng(seed);
      rngRef.current = rng;
      const first = generateProblem(rng, typeFilter === "all" ? undefined : typeFilter);
      setProblems([first]);
      setAnswers(emptyAnswers(first.type));
    }
    setIndex(0);
    setPhase("round");
  }

  function submit() {
    if (!current || feedback) return;
    setFeedback(gradeProblem(current, answers));
  }

  function retry() {
    if (!current || !feedback) return;
    const cleared: FieldAnswers = { ...answers };
    for (const field of FIELDS_BY_TYPE[current.type]) {
      if (!feedback.fields[field]) cleared[field] = "";
    }
    setAnswers(cleared);
    setFeedback(null);
  }

  async function next() {
    if (!current || !feedback || pending) return;

    if (mode === "endless") {
      setRunningStats((prev) => ({ solved: prev.solved + 1, correct: prev.correct + (feedback.correct ? 1 : 0) }));
      const nextProblem = generateProblem(rngRef.current!, typeFilter === "all" ? undefined : typeFilter);
      setProblems((prev) => [...prev, nextProblem]);
      setIndex((i) => i + 1);
      setAnswers(emptyAnswers(nextProblem.type));
      setFeedback(null);
      return;
    }

    // Quick mode
    const finalAnswers = [...collectedRef.current];
    finalAnswers[index] = { ...answers };
    collectedRef.current = finalAnswers;

    if (index + 1 < problems.length) {
      setIndex((i) => i + 1);
      setAnswers(emptyAnswers(problems[index + 1]!.type));
      setFeedback(null);
      return;
    }

    setPending(true);
    setError(null);
    const result = await recordQuickRound({
      seed: seedRef.current!,
      count: problems.length,
      types,
      answers: finalAnswers,
    });
    setPending(false);
    if (result.error || result.accuracy === undefined) {
      setError(result.error ?? "Something went wrong scoring that round. Try again.");
      return;
    }
    setSummary({
      accuracy: result.accuracy,
      correct: result.correct ?? 0,
      total: result.total ?? problems.length,
      best: result.best ?? result.accuracy,
    });
    setPhase("summary");
  }

  function backToSetup() {
    setPhase("setup");
    setProblems([]);
    setFeedback(null);
  }

  if (phase === "setup") {
    return (
      <div className="mt-8 flex flex-col gap-6">
        {bestAccuracy !== null && (
          <StatStrip>
            <Stat label="Best quick-round accuracy" value={<span className="text-score">{bestAccuracy}%</span>} />
          </StatStrip>
        )}

        <Card className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <Eyebrow>Mode</Eyebrow>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={mode === "quick" ? "primary" : "ghost"}
                onClick={() => setMode("quick")}
                className="w-fit"
              >
                Quick round (5 problems)
              </Button>
              <Button
                type="button"
                variant={mode === "endless" ? "primary" : "ghost"}
                onClick={() => setMode("endless")}
                className="w-fit"
              >
                Endless practice
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="type-filter">
                <Eyebrow as="span">Problem type</Eyebrow>
              </label>
              <Select
                id="type-filter"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as "all" | ProblemType)}
                className="w-fit min-w-[220px]"
              >
                <option value="all">All types</option>
                {PROBLEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </div>

            <Button type="button" variant="ghost" onClick={() => setTimerOn((v) => !v)} className="w-fit gap-1.5">
              <TimerIcon className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Timer: {timerOn ? "on" : "off"}
            </Button>
          </div>

          <Button type="button" onClick={start} className="w-fit gap-1.5">
            <Play className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Start
          </Button>
        </Card>
      </div>
    );
  }

  if (phase === "summary" && summary) {
    return (
      <div className="mt-8 flex flex-col gap-6">
        <StatStrip>
          <Stat
            label="Accuracy"
            value={<span className={summary.accuracy >= 70 ? "text-score" : "text-penalty"}>{summary.accuracy}%</span>}
          />
          <Stat label="Correct" value={`${summary.correct} / ${summary.total}`} />
          <Stat label="Best accuracy" value={`${summary.best}%`} />
          {timerOn && <Stat label="Time" value={formatElapsed(elapsedMs)} />}
        </StatStrip>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={start} className="w-fit gap-1.5">
            <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
            New round
          </Button>
          <Button type="button" variant="ghost" onClick={backToSetup} className="w-fit">
            Change settings
          </Button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const prompt = problemPrompt(current);
  const fields = FIELDS_BY_TYPE[current.type];
  const solution = feedback ? explainProblem(current) : null;

  return (
    <div className="mt-8 flex flex-col gap-4">
      <StatStrip>
        <Stat
          label={mode === "quick" ? "Problem" : "Solved"}
          value={mode === "quick" ? `${index + 1} / ${problems.length}` : runningStats.solved}
        />
        {mode === "endless" && (
          <Stat
            label="Running accuracy"
            value={
              runningStats.solved === 0
                ? "—"
                : `${Math.round((runningStats.correct / runningStats.solved) * 100)}%`
            }
          />
        )}
        {timerOn && <Stat label="Time" value={formatElapsed(elapsedMs)} />}
      </StatStrip>

      <Card className="p-6">
        <p className="text-sm leading-[20px] text-text">{prompt.title}</p>
        <div className="mt-4 rounded-md border border-hairline bg-surface-2 p-3">
          <p className="font-mono text-[13px] leading-[20px] text-text">{prompt.given}</p>
        </div>
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}

      {!feedback ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field} className="flex flex-col gap-1.5">
                <label htmlFor={`field-${field}`}>
                  <Eyebrow as="span">{FIELD_LABELS[field]}</Eyebrow>
                </label>
                <Input
                  id={`field-${field}`}
                  value={answers[field] ?? ""}
                  onChange={(event) => setAnswers((prev) => ({ ...prev, [field]: event.target.value }))}
                  autoFocus={field === fields[0]}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="font-mono tabular-nums"
                />
              </div>
            ))}
          </div>
          <Button type="submit" className="w-fit">
            Check answer
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-md border border-hairline bg-surface p-4">
            {fields.map((field) => {
              const ok = feedback.fields[field];
              return (
                <div key={field} className="flex items-start gap-2">
                  {ok ? (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-score" strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs text-text-dim">{FIELD_LABELS[field]}</span>
                    <span className="font-mono text-sm tabular-nums text-text">{answers[field] || "—"}</span>
                    {!ok && (
                      <span className="font-mono text-sm tabular-nums text-text-dim">
                        Expected: {feedback.expected[field]}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {solution && (
            <div className="flex flex-col gap-3 rounded-md border border-hairline bg-surface-2 p-4">
              <Eyebrow>Worked solution</Eyebrow>
              <div className="flex flex-col gap-1 font-mono text-[13px] leading-[20px] text-text">
                <p>IP:        {solution.ipBinary}</p>
                <p>Mask:      {solution.maskBinary}</p>
                <p>Network:   {solution.networkBinary}</p>
                <p>Broadcast: {solution.broadcastBinary}</p>
              </div>
              <ul className="flex flex-col gap-1.5 text-sm leading-[20px] text-text-dim">
                {solution.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!feedback.correct && (
              <Button type="button" variant="ghost" onClick={retry} className="w-fit">
                Try again
              </Button>
            )}
            <Button type="button" autoFocus onClick={() => void next()} disabled={pending} className="w-fit">
              {pending
                ? "Scoring…"
                : mode === "quick" && index + 1 === problems.length
                  ? "See results"
                  : "Next problem"}
            </Button>
            <p className="text-xs text-text-dim">
              Press <Kbd>Enter</Kbd>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
