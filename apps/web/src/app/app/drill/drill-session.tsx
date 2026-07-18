"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { Button, Card, EmptyState } from "@roundzero/ui";

import { rateCard } from "./actions";
import type { DrillCardView } from "@/lib/drill";

const RATINGS: { value: 1 | 2 | 3 | 4; label: string; hint: string }[] = [
  { value: 1, label: "Again", hint: "Didn't recall it" },
  { value: 2, label: "Hard", hint: "Recalled, but it was a struggle" },
  { value: 3, label: "Good", hint: "Recalled it correctly" },
  { value: 4, label: "Easy", hint: "Recalled it instantly" },
];

function typeLabel(type: DrillCardView["type"]): string {
  return type === "COMMAND" ? "Command" : "Concept";
}

export function DrillSession({ queue: liveQueue }: { queue: DrillCardView[] }) {
  // Frozen at mount, deliberately never resynced from the `queue` prop.
  // Rating a card calls a server action that revalidates this route, which
  // makes Next.js re-render the parent Server Component and pass down a
  // freshly re-fetched (shrinking) `queue` prop mid-session. Reading our
  // position against that live array would silently skip cards (index vs.
  // an array shrinking out from under it) and could show "all caught up"
  // while cards were still genuinely due. The session always works through
  // the fixed batch it started with; new cards surface on the next load.
  const queue = useRef(liveQueue).current;

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = queue.length;
  const current = queue[index];
  const done = index >= total;

  const reveal = useCallback(() => {
    if (!done && !revealed) setRevealed(true);
  }, [done, revealed]);

  const rate = useCallback(
    async (rating: 1 | 2 | 3 | 4) => {
      if (!current || pending) return;
      setPending(true);
      setError(null);
      const result = await rateCard({ stateId: current.stateId, rating });
      setPending(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setRevealed(false);
      setIndex((i) => i + 1);
    },
    [current, pending],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (done) return;
      if (event.key === " ") {
        event.preventDefault();
        reveal();
        return;
      }
      if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        void rate(Number(event.key) as 1 | 2 | 3 | 4);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [done, revealed, reveal, rate]);

  if (done) {
    return (
      <EmptyState
        className="mt-8"
        icon={CircleCheck}
        message="All caught up — nice work. Come back tomorrow for more, or get ahead by reading a lesson."
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/lessons">Browse lessons</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-4">
      <p className="font-mono text-xs tabular-nums text-text-dim">
        Card {index + 1} of {total}
      </p>

      <Card className="p-8">
        <p className="text-[11px] uppercase tracking-[0.06em] text-text-dim">
          {typeLabel(current!.type)}
        </p>
        <p className="mt-3 text-base leading-[24px] text-text">{current!.front}</p>

        {revealed && (
          <div className="mt-6 border-t border-hairline pt-6">
            {current!.type === "COMMAND" ? (
              <p className="whitespace-pre-wrap break-words font-mono text-[13px] leading-[20px] text-text">
                {current!.back}
              </p>
            ) : (
              <p className="text-sm leading-[20px] text-text-dim">{current!.back}</p>
            )}
          </div>
        )}
      </Card>

      {error && <p className="text-sm text-penalty">{error}</p>}

      {!revealed ? (
        <div className="flex flex-col items-start gap-2">
          <Button type="button" onClick={reveal} className="w-fit">
            Reveal
          </Button>
          <p className="text-xs text-text-dim">
            Press <kbd className="rounded-[3px] border border-hairline bg-surface-2 px-1 py-0.5 font-mono">Space</kbd>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-[0.06em] text-text-dim">
            How well did you know it?
          </p>
          <div className="flex flex-wrap gap-2">
            {RATINGS.map((rating) => (
              <button
                key={rating.value}
                type="button"
                disabled={pending}
                onClick={() => void rate(rating.value)}
                className="flex flex-1 min-w-[130px] flex-col items-center gap-1 rounded-md border border-hairline bg-surface px-3 py-3 text-center transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="font-mono text-xs tabular-nums text-text-dim">{rating.value}</span>
                <span className="text-sm text-text">{rating.label}</span>
                <span className="text-[11px] text-text-dim">{rating.hint}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-text-dim">
            Press{" "}
            <kbd className="rounded-[3px] border border-hairline bg-surface-2 px-1 py-0.5 font-mono">
              1
            </kbd>
            &ndash;
            <kbd className="rounded-[3px] border border-hairline bg-surface-2 px-1 py-0.5 font-mono">
              4
            </kbd>
          </p>
        </div>
      )}
    </div>
  );
}
