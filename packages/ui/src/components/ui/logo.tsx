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
/** Degrees off vertical. 34 off vertical is 124 in CSS gradient terms, which
 * is the value `brand-hatch` and `BrandField` both use — the three have to
 * agree or the mark stops being the geometry the page is built from. The
 * slash path below is computed from exactly this angle, not eyeballed. */
export const LOGO_SLASH_ANGLE = 34;

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
      {/* The zero, now a thin container rather than an equal partner. The
          earlier version drew ring and slash at the same 2.5 weight, so at
          22px — the size it actually renders in the nav — neither led and the
          mark read as generic. Weight contrast is what survives being shrunk;
          intersection detail is not. (A first attempt at this broke the ring
          where the slash crosses it; at 22px a 24-degree gap is invisible.) */}
      <rect
        x="5.6"
        y="3.2"
        width="20.8"
        height="25.6"
        rx="10.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeOpacity="0.85"
      />
      {/* The slash, now the mark itself: three times the ring's weight and
          running the full height.

          NOTE, because this reverses a documented decision rather than
          missing it. The previous slash was deliberately inset, on the
          argument that a diagonal crossing the whole mark reads as a "no
          entry" sign. That risk is real — it is the universal prohibition
          symbol. What makes this version survive it is that the bar is amber
          rather than red and the ring is too thin to read as the heavy
          circle of a prohibition badge. If it ever does read as "no", the
          fix is to pull the endpoints back toward the counter; the weight
          contrast is what matters, not the full bleed.

          Angle is exactly 124 degrees, matching `brand-hatch` in globals.css
          and the lattice in BrandField, so the mark is the geometry the page
          is built from rather than a badge that happens to sit on it. */}
      <path
        d="M23.27 5.22 L8.73 26.78"
        stroke={monochrome ? "currentColor" : "var(--accent)"}
        strokeWidth="5"
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
