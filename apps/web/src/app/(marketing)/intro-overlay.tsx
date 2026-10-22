"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The entrance. A full overlay that draws the slashed-zero mark, holds, then
 * wipes away to reveal the hero.
 *
 * ---------------------------------------------------------------------------
 * THE RULE THIS COMPONENT EXISTS UNDER: it must never be the reason content
 * is missing.
 *
 * Nothing is rendered on the server and nothing is rendered on the first
 * client paint — `armed` starts false and only flips inside an effect. So the
 * HTML that ships, the HTML a crawler sees, and the HTML a browser with dead
 * JavaScript renders all contain the full page with no overlay at all. An
 * intro that server-renders a black sheet is one failed hydration away from a
 * permanently black site, and that failure mode has already bitten this
 * project twice (DECISIONS on `Reveal`, and the terminal that rendered empty).
 * ---------------------------------------------------------------------------
 *
 * It is skipped entirely when:
 *   - `prefers-reduced-motion` is set — a 3.5s overlay is exactly what that
 *     setting exists to prevent
 *   - it has already played this tab session, so navigating back to `/` does
 *     not make you sit through it again
 *
 * It is escapable at any moment by click, any key, scroll, or the always-
 * visible Skip control. An entrance the visitor cannot leave is a hostage
 * situation, not a design.
 */

const SEEN_KEY = "rz.intro.seen";

/** Step timings in ms, cumulative. Total ~3.5s to fully clear. */
const DRAW_AT = 180;
const WORD_AT = 1500;
const WIPE_AT = 2750;
const DONE_AT = 3500;

export function IntroOverlay() {
  /** False during SSR and first paint. Only an effect may turn this on. */
  const [armed, setArmed] = useState(false);
  const [step, setStep] = useState<"draw" | "word" | "wipe">("draw");
  const ringRef = useRef<SVGPathElement>(null);
  const slashRef = useRef<SVGPathElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Private mode or storage disabled. Treat as unseen rather than
      // throwing — worst case someone sees the intro twice.
    }
    if (reduce || seen) return;

    setArmed(true);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    if (!armed) return;

    // Stroke lengths measured rather than guessed: `pathLength` is SVG2 and
    // not uniformly supported, and a wrong dasharray turns the draw into a
    // dotted mess. If the browser cannot measure, the mark simply fades in.
    //
    // The offset is driven straight on the node rather than through React
    // state, because the draw has to begin on the next frame — routing it
    // through a re-render tied to `step` started it at 1500ms, by which point
    // the overlay was already most of the way to wiping.
    const strokes = [ringRef.current, slashRef.current].filter(
      (n): n is SVGPathElement =>
        !!n && typeof n.getTotalLength === "function" && n.getTotalLength() > 0,
    );
    for (const node of strokes) {
      const len = node.getTotalLength();
      node.style.strokeDasharray = `${len}`;
      node.style.strokeDashoffset = `${len}`;
    }
    const raf = requestAnimationFrame(() => {
      for (const node of strokes) node.style.strokeDashoffset = "0";
    });

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const finish = () => {
      document.body.style.overflow = prevOverflow;
      setArmed(false);
    };

    const skip = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      finish();
    };

    timers.current = [
      window.setTimeout(() => setStep("word"), WORD_AT),
      window.setTimeout(() => setStep("wipe"), WIPE_AT),
      window.setTimeout(finish, DONE_AT),
    ];

    window.addEventListener("keydown", skip);
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("touchmove", skip, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      timers.current.forEach(clearTimeout);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchmove", skip);
      document.body.style.overflow = prevOverflow;
    };
  }, [armed]);

  if (!armed) return null;

  return (
    <div
      role="presentation"
      onClick={() => setArmed(false)}
      className={[
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg",
        "transition-[opacity,clip-path] duration-700 ease-[cubic-bezier(0.2,0,0,1)]",
        step === "wipe"
          ? "pointer-events-none opacity-0 [clip-path:inset(0_0_100%_0)]"
          : "opacity-100 [clip-path:inset(0_0_0_0)]",
      ].join(" ")}
    >
      <svg
        width="92"
        height="92"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        {/* The rounded rect of the real mark, expressed as a path so
            getTotalLength() works in every engine. Same geometry. */}
        <path
          ref={ringRef}
          d="M16 2.25 h0 a11.75 11.75 0 0 1 11.75 11.75 v4 A11.75 11.75 0 0 1 16 29.75 h0 A11.75 11.75 0 0 1 4.25 18 v-4 A11.75 11.75 0 0 1 16 2.25 z"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-text"
          style={{
            transition: `stroke-dashoffset 1200ms cubic-bezier(0.2,0,0,1) ${DRAW_AT}ms`,
          }}
        />
        <path
          ref={slashRef}
          d="M20.5 8.5 L11.5 23.5"
          stroke="#E8A33D"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{
            transition: `stroke-dashoffset 600ms cubic-bezier(0.2,0,0,1) ${DRAW_AT + 820}ms`,
          }}
        />
      </svg>

      <p
        className={[
          "mt-7 font-mono text-[11px] uppercase tracking-[0.34em] text-text-dim",
          "transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)]",
          step === "draw"
            ? "translate-y-1 opacity-0"
            : "translate-y-0 opacity-100",
        ].join(" ")}
      >
        RoundZero
      </p>

      <button
        type="button"
        onClick={() => setArmed(false)}
        className="absolute bottom-10 rounded-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim transition-colors duration-standard ease-standard hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Skip
      </button>
    </div>
  );
}
