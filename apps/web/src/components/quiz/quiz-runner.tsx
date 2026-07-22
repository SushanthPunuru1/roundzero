"use client";

// The shared question-set quiz engine (DECISIONS 033), generalized out of
// forensics' original quiz UI (DECISIONS 031/032). Fully prop-driven over
// two callbacks so any question-bank quiz — forensics, the networking quiz,
// and any future one — can reuse the exact same flow, feedback, retry, and
// summary UI without forking it. The page composing this component owns the
// server actions and binds whatever quiz-specific identifiers (archetype,
// category) they need via closures.

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CircleCheck, Circle } from "lucide-react";
import { Button, Card, ErrorNote, Eyebrow, Input, Kbd, Stat, StatStrip } from "@roundzero/ui";

export interface QuizRunnerQuestion {
  id: string;
  prompt: string;
  given?: string | null;
}

export interface QuizFormatDiff {
  caseMismatch: boolean;
  trailingSlashMismatch: boolean;
  whitespaceMismatch: boolean;
}

export interface QuizGradeResult {
  error?: string;
  status?: "correct" | "close" | "incorrect";
  diff?: QuizFormatDiff;
  answer?: string;
  technique?: string | null;
  why?: string;
}

export interface QuizCompleteResult {
  error?: string;
  score?: number;
  correct?: number;
  total?: number;
  enqueued?: number;
}

function closeReasonLines(diff: QuizFormatDiff | undefined): string[] {
  if (!diff) return [];
  const lines: string[] = [];
  if (diff.caseMismatch) lines.push("Right content, wrong case — this answer key cares about exact case.");
  if (diff.trailingSlashMismatch) lines.push("Right content, but check for a stray (or missing) trailing slash.");
  if (diff.whitespaceMismatch) lines.push("Right content, but the spacing doesn't match exactly — check for doubled or missing spaces.");
  return lines.length > 0
    ? lines
    : ["Close, but not an exact match — check the formatting against the answer below."];
}

export function QuizRunner({
  questions: initialQuestions,
  onGrade,
  onComplete,
  backHref,
  backLabel,
}: {
  questions: QuizRunnerQuestion[];
  onGrade: (input: { questionId: string; submitted: string }) => Promise<QuizGradeResult>;
  onComplete: (input: {
    answers: { questionId: string; submitted: string }[];
  }) => Promise<QuizCompleteResult>;
  backHref: string;
  backLabel: string;
}) {
  // Frozen at mount — a mid-session revalidation must never resync the
  // running queue out from under the student (DECISIONS 025/031).
  const queue = useRef(initialQuestions).current;

  const [index, setIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState<QuizGradeResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    score: number;
    correct: number;
    total: number;
    enqueued: number;
  } | null>(null);

  const total = queue.length;
  const current = queue[index];
  const isLastQuestion = index === total - 1;

  async function submit() {
    if (!current || pending || inputValue.trim().length === 0) return;
    setPending(true);
    setError(null);
    const result = await onGrade({ questionId: current.id, submitted: inputValue });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAnswers((prev) => ({ ...prev, [current.id]: inputValue }));
    setFeedback(result);
  }

  async function next() {
    if (pending) return;
    if (!isLastQuestion) {
      setIndex((i) => i + 1);
      setInputValue("");
      setFeedback(null);
      return;
    }

    setPending(true);
    setError(null);
    const result = await onComplete({
      answers: Object.entries(answers).map(([questionId, submitted]) => ({ questionId, submitted })),
    });
    setPending(false);
    if (result.error || result.score === undefined) {
      setError(result.error ?? "Something went wrong scoring this set. Try again.");
      return;
    }
    setSummary({
      score: result.score,
      correct: result.correct ?? 0,
      total: result.total ?? total,
      enqueued: result.enqueued ?? 0,
    });
  }

  function retryQuestion() {
    setInputValue("");
    setFeedback(null);
  }

  function retake() {
    setIndex(0);
    setInputValue("");
    setFeedback(null);
    setAnswers({});
    setError(null);
    setSummary(null);
  }

  if (summary) {
    return (
      <div className="mt-8 flex flex-col gap-6">
        <StatStrip>
          <Stat
            label="Score"
            value={
              <span className={summary.score >= 70 ? "text-score" : "text-penalty"}>
                {summary.score}%
              </span>
            }
          />
          <Stat label="Correct" value={`${summary.correct} / ${summary.total}`} />
        </StatStrip>
        {summary.enqueued > 0 && (
          <p className="text-sm text-text-dim">
            {summary.enqueued} missed question{summary.enqueued === 1 ? "" : "s"} added to your daily drill.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" className="w-fit" onClick={retake}>
            Retake
          </Button>
          <Button asChild variant="ghost" className="w-fit">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="mt-8 flex flex-col gap-4">
      <p className="font-mono text-xs tabular-nums text-text-dim">
        Question {index + 1} of {total}
      </p>

      <Card className="p-6">
        <p className="text-sm leading-[20px] text-text">{current.prompt}</p>
        {current.given && (
          <div className="mt-4 rounded-md border border-hairline bg-surface-2 p-3">
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[13px] leading-[20px] text-text">
              {current.given}
            </pre>
          </div>
        )}
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}

      {!feedback ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="quiz-answer">
            <Eyebrow as="span">Your answer</Eyebrow>
          </label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="quiz-answer"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="max-w-md font-mono"
              disabled={pending}
            />
            <Button type="submit" disabled={pending || inputValue.trim().length === 0} className="w-fit">
              {pending ? "Checking…" : "Submit"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-hairline bg-surface p-4">
          <div className="flex items-start gap-2">
            {feedback.status === "correct" ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-score" strokeWidth={1.75} aria-hidden="true" />
            ) : feedback.status === "close" ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
            )}
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-text">
                {feedback.status === "correct"
                  ? "Correct"
                  : feedback.status === "close"
                    ? "Close — check your formatting"
                    : "Incorrect"}
              </p>
              {feedback.status === "close" &&
                closeReasonLines(feedback.diff).map((line) => (
                  <p key={line} className="text-sm text-text-dim">
                    {line}
                  </p>
                ))}
              {feedback.status !== "correct" && (
                <p className="text-sm text-text-dim">
                  Answer: <span className="font-mono text-text">{feedback.answer}</span>
                </p>
              )}
            </div>
          </div>
          {(feedback.technique || feedback.why) && (
            <div className="border-t border-hairline pt-3">
              {feedback.technique && (
                <>
                  <Eyebrow>Technique</Eyebrow>
                  <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[13px] leading-[20px] text-text">
                    {feedback.technique}
                  </p>
                </>
              )}
              {feedback.why && <p className="mt-2 text-sm text-text-dim">{feedback.why}</p>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {feedback.status !== "correct" && (
              <Button type="button" variant="ghost" onClick={retryQuestion} disabled={pending} className="w-fit">
                Try again
              </Button>
            )}
            <Button type="button" autoFocus onClick={() => void next()} disabled={pending} className="w-fit">
              {pending ? "Scoring…" : isLastQuestion ? "See results" : "Next"}
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
