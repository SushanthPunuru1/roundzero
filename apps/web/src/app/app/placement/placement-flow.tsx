"use client";

// The placement wizard (ONBOARDING_PATH_SPEC.md Part A): self-report (2
// questions) -> adaptive knowledge check (server-driven, one question at a
// time) -> result. Deliberately does NOT import anything from "@roundzero/db"
// (see DECISIONS 034 — that package's client.ts constructs a real
// PrismaClient at module scope, unsafe in the browser); all shapes are
// local, mirroring quiz-runner.tsx's own precedent of not importing db types
// into a "use client" file.
//
// No per-question reveal, no right/wrong tally anywhere in this component —
// unsure/incorrect answers must never read as failure to the user (see the
// result screen and the early-exit offer below).

import { useState } from "react";
import Link from "next/link";
import { Button, Card, ErrorNote, Eyebrow } from "@roundzero/ui";

/** Sentinel choice value for "I'm not sure yet" — never a real options[]
 * index (those are always >= 0). Mirrors packages/db/src/placement/ladder.ts's
 * NOT_SURE; duplicated here only as a plain literal, not an import, per the
 * no-db-import rule above. */
const NOT_SURE = -1;

const EXPERIENCE_OPTIONS = [
  { value: "new", label: "New to it" },
  { value: "some", label: "Some — a class or self-taught" },
  { value: "competed", label: "Competed before" },
];

const FOCUS_OPTIONS = [
  { value: "windows", label: "Windows" },
  { value: "linux", label: "Linux" },
  { value: "cisco", label: "Cisco" },
  { value: "unsure", label: "Not sure yet" },
];

const DOMAIN_LABELS: Record<string, string> = {
  foundations: "Foundations concepts",
  linux: "Linux",
  windows: "Windows",
  networking: "Networking / Cisco",
};

// Domain block order the knowledge check actually asks in — matches
// packages/db/src/placement/parse.ts's PLACEMENT_DOMAINS. Drives the result
// screen's row order.
const RESULT_DOMAIN_ORDER = ["foundations", "linux", "windows", "networking"];

function levelLine(domain: string, level: string): string {
  if (domain === "foundations") {
    if (level === "FOUNDATIONS") return "Start with the Foundations lessons — that's exactly what they're for.";
    if (level === "STANDARD") return "You've got the basics down. A quick skim of the Foundations lessons should be plenty.";
    return "Solid on the core concepts — feel free to skip straight past the Foundations lessons.";
  }
  const name = DOMAIN_LABELS[domain] ?? domain;
  if (level === "FOUNDATIONS") return `You placed at Foundations for ${name} — start here.`;
  if (level === "STANDARD") return `You placed at Standard for ${name} — you can jump into the checklists.`;
  return `You placed at Advanced for ${name} — you're ready for the advanced material.`;
}

export interface PlacementQuestionView {
  id: string;
  domain: string;
  tier: string;
  prompt: string;
  options: string[];
}

export interface AdvanceOutcome {
  done?: boolean;
  question?: PlacementQuestionView;
  offerEarlyExit?: boolean;
  levels?: Record<string, string>;
  error?: string;
}

export interface PlacementFlowProps {
  totalQuestions: number;
  initialResult: { levels: Record<string, string> } | null;
  onAdvance: (input: {
    experience: string;
    focus: string[];
    answers: { questionId: string; choice: number }[];
    endEarly?: boolean;
  }) => Promise<AdvanceOutcome>;
  onReset: () => Promise<{ error?: string }>;
}

type Step = "self-report" | "knowledge" | "result";

export function PlacementFlow({ totalQuestions, initialResult, onAdvance, onReset }: PlacementFlowProps) {
  const [step, setStep] = useState<Step>(initialResult ? "result" : "self-report");
  const [experience, setExperience] = useState<string | null>(null);
  const [focus, setFocus] = useState<string[]>([]);
  const [answers, setAnswers] = useState<{ questionId: string; choice: number }[]>([]);
  const [question, setQuestion] = useState<PlacementQuestionView | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [offerEarlyExit, setOfferEarlyExit] = useState(false);
  const [resultLevels, setResultLevels] = useState<Record<string, string> | null>(
    initialResult?.levels ?? null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleFocus(value: string) {
    setFocus((prev) => {
      if (value === "unsure") return prev.includes("unsure") ? [] : ["unsure"];
      const withoutUnsure = prev.filter((entry) => entry !== "unsure");
      return withoutUnsure.includes(value)
        ? withoutUnsure.filter((entry) => entry !== value)
        : [...withoutUnsure, value];
    });
  }

  async function startKnowledgeCheck() {
    if (!experience || focus.length === 0 || pending) return;
    setPending(true);
    setError(null);
    const result = await onAdvance({ experience, focus, answers: [] });
    setPending(false);
    if (result.error || !result.question) {
      setError(result.error ?? "Something went wrong starting the check. Try again.");
      return;
    }
    setQuestion(result.question);
    setOfferEarlyExit(false);
    setStep("knowledge");
  }

  async function submitAnswer() {
    if (!question || selectedChoice === null || pending || !experience) return;
    const nextAnswers = [...answers, { questionId: question.id, choice: selectedChoice }];
    setPending(true);
    setError(null);
    const result = await onAdvance({ experience, focus, answers: nextAnswers });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAnswers(nextAnswers);
    if (result.done) {
      setResultLevels(result.levels ?? null);
      setStep("result");
      return;
    }
    setQuestion(result.question ?? null);
    setSelectedChoice(null);
    setOfferEarlyExit(Boolean(result.offerEarlyExit));
  }

  async function endEarly() {
    if (pending || !experience) return;
    setPending(true);
    setError(null);
    const result = await onAdvance({ experience, focus, answers, endEarly: true });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setResultLevels(result.levels ?? null);
    setStep("result");
  }

  async function retake() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await onReset();
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setExperience(null);
    setFocus([]);
    setAnswers([]);
    setQuestion(null);
    setSelectedChoice(null);
    setOfferEarlyExit(false);
    setResultLevels(null);
    setStep("self-report");
  }

  const skipLink = (
    <Button asChild variant="ghost" className="w-fit">
      <Link href="/app/lessons">Skip and browse everything</Link>
    </Button>
  );

  if (step === "result" && resultLevels) {
    return (
      <div className="mt-8 flex flex-col gap-6">
        <Card className="p-6">
          <Eyebrow>Here&apos;s where to start</Eyebrow>
          <div className="mt-4 flex flex-col gap-3">
            {RESULT_DOMAIN_ORDER.map((domain) => (
              <p key={domain} className="text-sm leading-[20px] text-text">
                {levelLine(domain, resultLevels[domain] ?? "FOUNDATIONS")}
              </p>
            ))}
          </div>
        </Card>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" className="w-fit" onClick={() => void retake()} disabled={pending}>
            {pending ? "Resetting…" : "Retake placement"}
          </Button>
          <Button asChild className="w-fit">
            <Link href="/app/lessons">Browse lessons</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (step === "knowledge" && question) {
    if (offerEarlyExit) {
      return (
        <div className="mt-8 flex flex-col gap-6">
          <Card className="p-6">
            <p className="text-sm leading-[20px] text-text">
              That&apos;s all we need to point you in the right direction.
            </p>
            <p className="mt-2 text-sm leading-[20px] text-text-dim">
              You can stop here and start at the beginning, or keep going if you&apos;d like a more detailed
              placement.
            </p>
          </Card>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="w-fit" onClick={() => void endEarly()} disabled={pending}>
              {pending ? "One moment…" : "That's all we need — start me at the beginning"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-fit"
              onClick={() => setOfferEarlyExit(false)}
              disabled={pending}
            >
              Keep going
            </Button>
          </div>
          {skipLink}
        </div>
      );
    }

    return (
      <div className="mt-8 flex flex-col gap-4">
        <p className="font-mono text-xs tabular-nums text-text-dim">
          Question {answers.length + 1} of {totalQuestions}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitAnswer();
          }}
          className="flex flex-col gap-4"
        >
          <fieldset className="rounded-md border border-hairline bg-surface p-4">
            <legend className="px-1 text-sm font-medium text-text">{question.prompt}</legend>
            <div className="mt-3 flex flex-col gap-2">
              {question.options.map((option, index) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-text hover:bg-surface-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-bg"
                >
                  <input
                    type="radio"
                    name="choice"
                    value={index}
                    checked={selectedChoice === index}
                    onChange={() => setSelectedChoice(index)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  {option}
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-text-dim hover:bg-surface-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-bg">
                <input
                  type="radio"
                  name="choice"
                  value={NOT_SURE}
                  checked={selectedChoice === NOT_SURE}
                  onChange={() => setSelectedChoice(NOT_SURE)}
                  className="size-4 accent-[var(--accent)]"
                />
                I&apos;m not sure yet
              </label>
            </div>
          </fieldset>

          {error && <ErrorNote>{error}</ErrorNote>}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={selectedChoice === null || pending} className="w-fit">
              {pending ? "One moment…" : "Continue"}
            </Button>
          </div>
        </form>
        {skipLink}
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <Card className="p-6">
        <p className="text-sm leading-[20px] text-text-dim">
          About 3 minutes. Answer what you can — &quot;I&apos;m not sure yet&quot; is always a fine answer. We use
          this to point you at the right place to begin, never to score or rank you.
        </p>
      </Card>

      <fieldset className="rounded-md border border-hairline bg-surface p-4">
        <legend className="px-1 text-sm font-medium text-text">
          How much cybersecurity experience do you have?
        </legend>
        <div className="mt-3 flex flex-col gap-2">
          {EXPERIENCE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-text hover:bg-surface-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-bg"
            >
              <input
                type="radio"
                name="experience"
                value={option.value}
                checked={experience === option.value}
                onChange={() => setExperience(option.value)}
                className="size-4 accent-[var(--accent)]"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-md border border-hairline bg-surface p-4">
        <legend className="px-1 text-sm font-medium text-text">Which machine do you want to focus on?</legend>
        <div className="mt-3 flex flex-col gap-2">
          {FOCUS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-text hover:bg-surface-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-bg"
            >
              <input
                type="checkbox"
                name="focus"
                value={option.value}
                checked={focus.includes(option.value)}
                onChange={() => toggleFocus(option.value)}
                className="size-4 accent-[var(--accent)]"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={!experience || focus.length === 0 || pending}
          onClick={() => void startKnowledgeCheck()}
          className="w-fit"
        >
          {pending ? "One moment…" : "Start the knowledge check"}
        </Button>
      </div>
      {skipLink}
    </div>
  );
}
