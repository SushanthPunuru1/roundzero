"use client";

import { useEffect, useRef, useState } from "react";

/** Same path as packages/ui logo.tsx. Duplicated rather than imported
 * because that module has no "use client" and this file is a client
 * component — the geometry check in the gate below keeps them honest. */
const ZERO =
  "M128,0H202A128,122 0 0 1 330,122V296A128,122 0 0 1 202,418H128A128,122 0 0 1 0,296V122A128,122 0 0 1 128,0Z " +
  "M135,77H195A54,53 0 0 1 249,130V287A54,53 0 0 1 195,340H135A54,53 0 0 1 81,287V130A54,53 0 0 1 135,77Z";

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
    const strokes = [ringRef.current].filter(
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
      {/* Geometry is the same ZERO path packages/ui logo.tsx uses. If these
          drift, the intro draws a different logo than the header shows.

          The sequence: the outline strokes itself on, the solid body fades
          in behind it, then the amber band wipes through. A filled shape
          cannot stroke-draw, so the outline is a separate stroked copy that
          exists only for the duration of the draw. */}
      <svg
        width="104"
        height="132"
        viewBox="0 0 330 418"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <clipPath id="rz-intro-clip">
            <path d={ZERO} fillRule="evenodd" clipRule="evenodd" />
          </clipPath>
          <mask id="rz-intro-gap" maskUnits="userSpaceOnUse" x="-10" y="-10" width="350" height="438">
            <rect x="-10" y="-10" width="350" height="438" fill="#FFFFFF" />
            <rect x="-600" y="-29.5" width="1200" height="59" transform="translate(165 209) rotate(124)" fill="#000000" />
          </mask>
        </defs>

        {/* The solid mark, revealed after the outline has drawn. */}
        <g
          clipPath="url(#rz-intro-clip)"
          className="text-text"
          style={{
            opacity: step === "draw" ? 0 : 1,
            transition: "opacity 520ms cubic-bezier(0.2,0,0,1)",
          }}
        >
          <path d={ZERO} fill="currentColor" fillRule="evenodd" mask="url(#rz-intro-gap)" />
          <rect x="-600" y="-21.5" width="1200" height="43" transform="translate(165 209) rotate(124)" fill="#E8A33D" />
          <g fill="none" stroke="#E8A33D" strokeWidth="12" strokeLinejoin="miter">
            <path d="M46 214V238L-8 292" />
            <circle cx="46" cy="194" r="20" />
          </g>
        </g>

        {/* The drawing outline. Fades out as the solid form arrives, so the
            two never both read as edges at once. */}
        <path
          ref={ringRef}
          d={ZERO}
          stroke="currentColor"
          strokeWidth="6"
          className="text-text"
          style={{
            opacity: step === "draw" ? 1 : 0,
            transition: `stroke-dashoffset 1250ms cubic-bezier(0.2,0,0,1) ${DRAW_AT}ms, opacity 420ms linear`,
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
