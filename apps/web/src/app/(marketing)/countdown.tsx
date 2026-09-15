"use client";

import { useEffect, useState } from "react";

/**
 * The number counts up to its real value once, on mount. Not decoration: a
 * number that lands rather than simply appearing is the difference between
 * reading it and feeling it, and this is the only number on the page that
 * carries urgency.
 *
 * Readers who asked for reduced motion get the final value immediately —
 * checked here rather than left to CSS, because this is a JS-driven count and
 * the global transition override in globals.css cannot reach it.
 *
 * The date and the day-count live in round-one.ts, outside the client
 * boundary, so the server component can compute `days` and pass it down.
 */
export function CountdownNumber({ days }: { days: number }) {
  const [shown, setShown] = useState(days);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const DURATION = 900;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      // Ease-out: fast at first, settling at the end, so it reads as landing
      // on a value rather than ticking toward one.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(days * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    setShown(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [days]);

  return (
    <span className="font-mono tabular-nums" aria-label={`${days} days`}>
      {shown}
    </span>
  );
}
