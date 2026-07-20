"use client";

import * as React from "react";

import { cn } from "../../lib/utils";

export interface CountUpProps {
  /** The true, final value. Also the component's at-rest DOM state — the
   * server-rendered/no-JS/motion-disabled output always equals this. */
  value: number;
  /** Value to animate from on first mount. Ignored (no animation) when
   * `prefers-reduced-motion` is set. */
  from?: number;
  durationMs?: number;
  className?: string;
  formatter?: (n: number) => string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * DESIGN.md's one expressive motion exception: a score value counts up over
 * ~400ms with a brief `--score` text flash. The DOM is correct at rest
 * whether or not JS runs — `useState`'s initial render is always `value`
 * (matching SSR output 1:1, no hydration mismatch); an effect only kicks in
 * post-mount, client-side, to animate from `from` up to `value`, landing
 * exactly on it. Renders are enhancement only, never the source of truth.
 */
function CountUp({ value, from = 0, durationMs = 400, className, formatter }: CountUpProps) {
  const [display, setDisplay] = React.useState(value);
  const [flashing, setFlashing] = React.useState(false);
  const firstRun = React.useRef(true);
  const prevValue = React.useRef(value);

  React.useEffect(() => {
    const start = firstRun.current ? from : prevValue.current;
    const end = value;
    firstRun.current = false;
    prevValue.current = value;

    if (start === end) {
      setDisplay(end);
      return;
    }

    if (prefersReducedMotion()) {
      setDisplay(end);
      return;
    }

    let raf = 0;
    const startedAt = performance.now();
    setFlashing(true);
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      setDisplay(Math.round(start + (end - start) * t));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        setFlashing(false);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, from, durationMs]);

  return (
    <span
      className={cn(
        "font-mono tabular-nums transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
        flashing && "text-score",
        className,
      )}
    >
      {formatter ? formatter(display) : display}
    </span>
  );
}

export { CountUp };
