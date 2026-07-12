"use client";

import { useActionState, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@roundzero/ui";

import { submitCheck, type CheckActionState } from "./actions";

export interface LessonCheckQuestion {
  q: string;
  options: string[];
}

const initialState: CheckActionState = {};

export function LessonCheck({
  slug,
  questions,
  initialBestScore,
}: {
  slug: string;
  questions: LessonCheckQuestion[];
  initialBestScore: number | null;
}) {
  const [state, formAction, pending] = useActionState(submitCheck, initialState);
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const [retaking, setRetaking] = useState(false);

  // A fresh submission result means the check was resubmitted — surface it
  // instead of the retake form. This mirrors React's documented pattern for
  // adjusting state in response to a prop/value change without an Effect.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    setRetaking(false);
  }

  const allAnswered = questions.length > 0 && answered.size === questions.length;
  const revealed = state.result !== undefined && !retaking;

  return (
    <div className="mt-10 border-t border-hairline pt-8">
      <h2 className="text-[20px] font-semibold leading-[28px] text-text">Check your understanding</h2>
      <p className="mt-1 text-sm text-text-dim">
        {initialBestScore !== null && !revealed
          ? `Best score so far: ${initialBestScore}%. Retake anytime.`
          : `${questions.length} question${questions.length === 1 ? "" : "s"} — answer them all, then submit.`}
      </p>

      {revealed && state.result ? (
        <div className="mt-6 flex flex-col gap-4">
          <p className="font-mono text-2xl tabular-nums text-text">
            <span className={state.result.score >= 70 ? "text-score" : "text-penalty"}>
              {state.result.score}%
            </span>
          </p>
          <div className="flex flex-col gap-3">
            {questions.map((question, index) => {
              const result = state.result!.questions[index]!;
              return (
                <div
                  key={question.q}
                  className="rounded-md border border-hairline bg-surface p-4"
                >
                  <div className="flex items-start gap-2">
                    {result.correct ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-score" strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <X className="mt-0.5 size-4 shrink-0 text-penalty" strokeWidth={1.75} aria-hidden="true" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-text">{question.q}</p>
                      <p className="mt-1 text-sm text-text-dim">{result.why}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-fit"
            onClick={() => setRetaking(true)}
          >
            Retake
          </Button>
        </div>
      ) : (
        <form action={formAction} className="mt-6 flex flex-col gap-6">
          <input type="hidden" name="slug" value={slug} />
          {questions.map((question, qIndex) => (
            <fieldset key={question.q} className="rounded-md border border-hairline bg-surface p-4">
              <legend className="px-1 text-sm font-medium text-text">{question.q}</legend>
              <div className="mt-3 flex flex-col gap-2">
                {question.options.map((option, oIndex) => (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-text hover:bg-surface-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-bg"
                  >
                    <input
                      type="radio"
                      name={`q${qIndex}`}
                      value={oIndex}
                      required
                      className="size-4 accent-[var(--accent)]"
                      onChange={() =>
                        setAnswered((prev) => {
                          const next = new Set(prev);
                          next.add(qIndex);
                          return next;
                        })
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {state.error && <p className="text-sm text-penalty">{state.error}</p>}

          <Button type="submit" disabled={!allAnswered || pending} className="w-fit">
            {pending ? "Grading…" : "Submit answers"}
          </Button>
        </form>
      )}
    </div>
  );
}
