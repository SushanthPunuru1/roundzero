"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Minus, X } from "lucide-react";

import { cn } from "@roundzero/ui";

/** Runs `onEnter` once, the first time the element is scrolled into view.
 * Same mechanism as Reveal, but for driving an animation rather than
 * fading a wrapper — kept separate so Reveal stays a pure presentational
 * wrapper with no callbacks. */
function useInView<T extends HTMLElement>(onEnter: () => void) {
  const ref = useRef<T>(null);
  const fired = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.current) {
            fired.current = true;
            onEnter();
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -20% 0px", threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onEnter]);

  return ref;
}

const TERMINAL_LINES = [
  { prompt: true, text: "sudo awk -F: '$3==0 {print $1}' /etc/passwd" },
  { prompt: false, text: "root" },
  { prompt: false, text: "backdoor" },
  { prompt: true, text: "sudo usermod -u 1005 backdoor" },
  { prompt: true, text: "grep -E 'PermitRootLogin' /etc/ssh/sshd_config" },
  { prompt: false, text: "PermitRootLogin yes" },
];

/**
 * A terminal typing itself out. Not a video and not a screenshot — the real
 * commands from the Linux track, so what someone sees on the landing page is
 * literally what they will type in the lab.
 */
export function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(0);
  const ref = useInView<HTMLDivElement>(() => setVisibleLines(1));

  useEffect(() => {
    if (visibleLines === 0 || visibleLines >= TERMINAL_LINES.length) return;
    const timer = setTimeout(() => setVisibleLines((n) => n + 1), 520);
    return () => clearTimeout(timer);
  }, [visibleLines]);

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-md border border-hairline bg-surface"
    >
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
          linux-practice
        </span>
        <span className="font-mono text-[11px] text-text-dim">root@lab</span>
      </div>
      <div className="min-h-[188px] space-y-1 p-4 font-mono text-[13px] leading-[20px]">
        {TERMINAL_LINES.slice(0, visibleLines).map((line, index) => (
          <p
            key={index}
            className={cn(
              "animate-[fadeIn_240ms_ease-out]",
              line.prompt ? "text-text" : "text-text-dim",
            )}
          >
            {/* Not --score: green means "check passed" everywhere else in
                this product, and a shell prompt is decoration. */}
            {line.prompt && <span className="text-accent">$ </span>}
            {line.text}
          </p>
        ))}
        {visibleLines > 0 && visibleLines < TERMINAL_LINES.length && (
          <span className="inline-block h-[14px] w-[7px] translate-y-0.5 animate-pulse bg-text" />
        )}
      </div>
    </div>
  );
}

const SCORE_ROWS = [
  { state: "found", title: "Second UID-0 account removed", points: 12 },
  { state: "found", title: "Root SSH login disabled", points: 12 },
  { state: "missed", title: "Password history not enforced", points: 8 },
  { state: "found", title: "World-writable /etc/passwd fixed", points: 8 },
  { state: "missed", title: "Firewall left inactive", points: 10 },
] as const;

/**
 * The debrief, resolving one line at a time.
 *
 * This is the section that has to land, because `CLAUDE.md` opens with "the
 * debrief is the product" — the pitch is not that you get a lab, it is that
 * you find out exactly what you missed and why.
 *
 * Green and red here are `--score` and `--penalty` used for their actual
 * scoring meaning, which is the one use DESIGN.md permits. They are never
 * decoration on this page either.
 */
export function DebriefDemo() {
  const [revealed, setRevealed] = useState(0);
  const ref = useInView<HTMLDivElement>(() => setRevealed(1));

  useEffect(() => {
    if (revealed === 0 || revealed >= SCORE_ROWS.length) return;
    // 340ms per row meant 1.7s before the card was whole, and because every
    // row is already in the DOM at opacity-0 the panel is full height the
    // entire time — so mid-scroll it read as a broken box with a void under
    // it. Fast enough now that the card fills before it has been looked at.
    const timer = setTimeout(() => setRevealed((n) => n + 1), 130);
    return () => clearTimeout(timer);
  }, [revealed]);

  const earned = SCORE_ROWS.slice(0, revealed)
    .filter((row) => row.state === "found")
    .reduce((sum, row) => sum + row.points, 0);

  return (
    <div ref={ref} className="rounded-md border border-hairline bg-surface">
      <div className="flex items-baseline justify-between border-b border-hairline px-5 py-4">
        <p className="text-[13px] text-text-dim">Debrief</p>
        <p className="font-mono text-[25px] font-semibold leading-[32px] tabular-nums text-text">
          {earned}
          <span className="text-[13px] font-normal text-text-dim"> / 50</span>
        </p>
      </div>
      <ul className="divide-y divide-hairline">
        {SCORE_ROWS.map((row, index) => {
          const shown = index < revealed;
          const found = row.state === "found";
          return (
            <li
              key={row.title}
              className={cn(
                "flex items-center gap-3 px-5 py-3 transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)]",
                shown ? "opacity-100" : "motion-safe:translate-x-1 opacity-0",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-[3px]",
                  !shown && "bg-surface-2",
                  shown && found && "bg-score/15 text-score",
                  shown && !found && "bg-penalty/15 text-penalty",
                )}
              >
                {!shown ? (
                  <Minus className="size-3" strokeWidth={1.75} aria-hidden="true" />
                ) : found ? (
                  <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
                )}
              </span>
              <span className="flex-1 text-sm text-text">{row.title}</span>
              <span
                className={cn(
                  "font-mono text-[13px] tabular-nums",
                  found ? "text-score" : "text-text-dim",
                )}
              >
                {found ? `+${row.points}` : `0/${row.points}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
