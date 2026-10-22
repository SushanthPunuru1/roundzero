import * as React from "react";

import { cn } from "../../lib/utils";

/**
 * The RoundZero mark: a slashed zero held inside a shield.
 *
 * The name is the idea. Competitions have Round 1, Round 2, semis, finals —
 * Round Zero is the one you run yourself, before any of it counts. So the
 * mark is a zero, and specifically the *monospace* zero, the one with a slash
 * through it that exists so a terminal can tell 0 from O. The shield is what
 * the zero is for.
 *
 * ---------------------------------------------------------------------------
 * IT IS TWO MARKS, AND THAT IS DELIBERATE.
 *
 * `detail` adds circuit traces running in from the shield's edges. They are
 * genuinely good at 48px and up — and they are mud at 22px, which is the size
 * the nav and the app shell actually render. A logo that only works at one
 * size is a logo that will look broken at the other, so this ships a detailed
 * form and a simplified form of the same drawing rather than one compromise
 * that is mediocre at both. Hero, intro, social card and large favicon take
 * `detail`; everything else does not.
 * ---------------------------------------------------------------------------
 *
 * The slash runs at exactly 124°, the same angle as `brand-hatch` in
 * globals.css and the lattice in `BrandField`. Endpoints are computed from
 * that angle about the zero's center rather than eyeballed, so the mark is
 * the geometry the page is built from rather than a badge sitting on it.
 *
 * `currentColor` on the shield and zero, accent on the slash. One-tone
 * callers pass `monochrome` and get a mark that still reads — which the
 * checklist export needs, since it prints in a single ink on warm paper.
 */
export const LOGO_SLASH_ANGLE = 34; // degrees off vertical; 124 in CSS terms

/** Shield silhouette. Flat shoulders, tapering to a point — angular rather
 * than the soft heraldic curve, which reads closer to DESIGN.md's
 * "instrument" than to a badge. */
const SHIELD =
  "M16 2.4 L27.4 7.0 V16.6 C27.4 23.5 22.5 28.0 16 30.2 C9.5 28.0 4.6 23.5 4.6 16.6 V7.0 Z";

export interface LogoProps extends React.SVGProps<SVGSVGElement> {
  /** Drop the accent on the slash — favicons, print, anywhere color is
   * unavailable or would be noise. */
  monochrome?: boolean;
  /** Add the circuit traces. Only legible at ~48px and up; leave off for nav
   * and inline use. */
  detail?: boolean;
}

export const Logo = React.forwardRef<SVGSVGElement, LogoProps>(
  ({ className, monochrome = false, detail = false, ...props }, ref) => {
    const accent = monochrome ? "currentColor" : "var(--accent)";
    return (
      <svg
        ref={ref}
        viewBox="0 0 32 32"
        fill="none"
        role="img"
        aria-label="RoundZero"
        className={cn("size-8", className)}
        {...props}
      >
        {/* The shield. Filled at low opacity so it reads as a solid object
            rather than a wireframe, then outlined so the silhouette stays
            crisp when it shrinks. */}
        <path d={SHIELD} fill="currentColor" fillOpacity="0.09" />
        <path
          d={SHIELD}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Circuit traces: in from each edge, stepping at 45°, ending in a
            node. Drawn before the zero so the zero always sits on top. */}
        {detail && (
          <g
            stroke={accent}
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.75"
          >
            <path d="M5.1 11.4 H7.4 L9.0 13.0" />
            <path d="M5.1 18.8 H8.8" />
            <path d="M26.9 12.6 H24.6 L23.0 14.2" />
            <path d="M26.9 20.4 H23.6 L22.4 21.6" />
            <circle cx="5.1" cy="11.4" r="0.95" fill={accent} stroke="none" />
            <circle cx="5.1" cy="18.8" r="0.95" fill={accent} stroke="none" />
            <circle cx="26.9" cy="12.6" r="0.95" fill={accent} stroke="none" />
            <circle cx="26.9" cy="20.4" r="0.95" fill={accent} stroke="none" />
          </g>
        )}

        {/* The zero — a narrow oval, the proportion of a mono typeface's 0
            rather than a circle, which would read as a target. */}
        <ellipse
          cx="16"
          cy="15.4"
          rx="5.4"
          ry="6.8"
          stroke="currentColor"
          strokeWidth="2.4"
        />
        {/* The slash. Overshoots the counter slightly at both ends so it
            reads as struck through the zero rather than contained by it. */}
        <path
          d="M20.362 8.934 L11.638 21.866"
          stroke={accent}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    );
  },
);
Logo.displayName = "Logo";

/**
 * Mark plus wordmark. "Round" in the body weight, "Zero" in mono — the
 * typographic split says the same thing the mark does, that the zero is the
 * part that means something.
 */
export const Wordmark = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { markClassName?: string }
>(({ className, markClassName, ...props }, ref) => (
  <span
    ref={ref}
    className={cn("inline-flex items-center gap-2.5 text-text", className)}
    {...props}
  >
    <Logo className={cn("size-6", markClassName)} />
    <span className="text-[15px] font-semibold tracking-[-0.01em]">
      Round<span className="font-mono font-medium">Zero</span>
    </span>
  </span>
));
Wordmark.displayName = "Wordmark";
