import * as React from "react";

import { cn } from "../../lib/utils";

/**
 * The RoundZero mark: a slashed zero.
 *
 * The name is the idea. Competitions have Round 1, Round 2, semis, finals —
 * Round Zero is the one you run yourself, before any of it counts. So the
 * mark is a zero, and specifically the *monospace* zero, the one with a
 * slash through it that exists so a terminal can tell 0 from O.
 *
 * Three things it has to do, which is why it is drawn rather than set in a
 * typeface: read at 16px in a nav and at 400px on a landing page; survive
 * being one color when it has to (favicon, print, a sticker); and give the
 * rest of the design a motif — the slash angle is reused as the diagonal in
 * section rules and hover states, so the mark is not a logo sitting in a
 * corner but the geometry the site is built from.
 *
 * `currentColor` on the ring, accent on the slash. One-tone callers pass
 * `monochrome` and get a mark that still reads.
 */
export const LOGO_SLASH_ANGLE = 34; // degrees off vertical — reused site-wide

export interface LogoProps extends React.SVGProps<SVGSVGElement> {
  /** Drop the accent on the slash — favicons, print, anywhere color is
   * unavailable or would be noise. */
  monochrome?: boolean;
}

export const Logo = React.forwardRef<SVGSVGElement, LogoProps>(
  ({ className, monochrome = false, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="RoundZero"
      className={cn("size-8", className)}
      {...props}
    >
      {/* The zero. A superellipse rather than a circle — a true circle reads
          as a target or a loading spinner; the flattened sides read as a
          glyph, which is what it is. */}
      <rect
        x="4.25"
        y="2.25"
        width="23.5"
        height="27.5"
        rx="11.75"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      {/* The slash. Inset from the ring's bounds so it reads as struck
          through the counter rather than crossing the whole mark — the
          latter looks like a "no entry" sign, which is the opposite of an
          invitation. */}
      <path
        d="M20.5 8.5 L11.5 23.5"
        stroke={monochrome ? "currentColor" : "var(--accent)"}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  ),
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
