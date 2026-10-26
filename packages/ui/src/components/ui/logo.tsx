import * as React from "react";

import { cn } from "../../lib/utils";

/**
 * The RoundZero mark: a slashed zero, cut by an amber band.
 *
 * The name is the idea. Competitions have Round 1, Round 2, semis, finals —
 * Round Zero is the one you run yourself, before any of it counts. So the
 * mark is a zero, and specifically the *monospace* zero, the one with a slash
 * through it that exists so a terminal can tell 0 from O.
 *
 * Geometry is ported verbatim from the commissioned vector (DECISIONS 056),
 * not redrawn. The construction is worth understanding before editing:
 *
 *   `ring-clip`   the zero itself — outer squircle minus the counter, evenodd.
 *                 Everything else is clipped to it, which is why the band and
 *                 the circuit trace stop at the zero's edges instead of
 *                 running off into the box.
 *   `body-mask`   white everywhere except a 59-unit black bar at 124°. That
 *                 bar is what removes the body where the band crosses, so the
 *                 amber sits in a clean 8-unit gap rather than on top of the
 *                 navy. The amber bar is 43 units; 59 − 43 = 16, split either
 *                 side. Change one width and you must change the other.
 *
 * ---------------------------------------------------------------------------
 * WHY THE BODY IS `currentColor` AND NOT NAVY.
 *
 * The source asset fills the body with #16243F, which is right on white — it
 * scores 13.7:1 on the print datasheet's warm paper. Against `--bg` (#0B0D11)
 * it is 1.26:1. That is not low contrast, it is two shades of the same
 * near-black: the zero would vanish and leave an amber band floating in a
 * void. So the body inherits text color and the mark inverts correctly per
 * surface — 16.2:1 on the dark app, 13.7:1 in print — while the amber band
 * stays constant at 9.0:1 on dark and 7.2:1 on navy. The band is the one
 * element that carries the brand, so it is the one element that never changes.
 * `--navy` still exists as a token for light surfaces (og:image, social).
 * ---------------------------------------------------------------------------
 *
 * The band runs at exactly 124°, the same angle as `brand-hatch` in
 * globals.css and the lattice in `BrandField`, so the mark is the geometry
 * the page is built from rather than a badge sitting on it.
 */
export const LOGO_SLASH_ANGLE = 34; // degrees off vertical; 124 in CSS terms

/** The zero: outer squircle, inner counter, even-odd so the counter is a
 * hole rather than a second shape. */
const ZERO =
  "M128,0H202A128,122 0 0 1 330,122V296A128,122 0 0 1 202,418H128A128,122 0 0 1 0,296V122A128,122 0 0 1 128,0Z " +
  "M135,77H195A54,53 0 0 1 249,130V287A54,53 0 0 1 195,340H135A54,53 0 0 1 81,287V130A54,53 0 0 1 135,77Z";

export interface LogoProps extends React.SVGProps<SVGSVGElement> {
  /** Drop the amber: the band becomes a transparent cut and the circuit trace
   * is omitted. For favicons, single-ink print, and anywhere color would be
   * noise. Matches the commissioned C/D variants. */
  monochrome?: boolean;
  /** Draw the circuit trace. Legible from roughly 40px up; below that it is
   * mud, so nav and inline uses leave it off. */
  detail?: boolean;
}

export const Logo = React.forwardRef<SVGSVGElement, LogoProps>(
  ({ className, monochrome = false, detail = false, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 330 418"
      fill="none"
      role="img"
      aria-label="RoundZero"
      className={cn("size-8", className)}
      {...props}
    >
      {/* Fixed ids, deliberately not `useId`: this file has no "use client"
          and renders inside Server Components, where hooks are unavailable.
          Duplicate SVG ids resolve to the first in document order, which is
          harmless because every instance of these defs is identical. */}
      <defs>
        <clipPath id="rz-zero-clip">
          <path d={ZERO} fillRule="evenodd" clipRule="evenodd" />
        </clipPath>
        <mask id="rz-band-gap" maskUnits="userSpaceOnUse" x="-10" y="-10" width="350" height="438">
          <rect x="-10" y="-10" width="350" height="438" fill="#FFFFFF" />
          <rect
            x="-600"
            y="-29.5"
            width="1200"
            height="59"
            transform="translate(165 209) rotate(124)"
            fill="#000000"
          />
        </mask>
      </defs>

      <g clipPath="url(#rz-zero-clip)">
        <path d={ZERO} fill="currentColor" fillRule="evenodd" mask="url(#rz-band-gap)" />
        {!monochrome && (
          <rect
            x="-600"
            y="-21.5"
            width="1200"
            height="43"
            transform="translate(165 209) rotate(124)"
            fill="var(--accent)"
          />
        )}
        {detail && !monochrome && (
          <g fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinejoin="miter">
            <path d="M46 214V238L-8 292" />
            <circle cx="46" cy="194" r="20" />
          </g>
        )}
      </g>
    </svg>
  ),
);
Logo.displayName = "Logo";

/**
 * Mark plus wordmark. "Round" in the body weight, "Zero" in mono — the
 * typographic split says the same thing the mark does, that the zero is the
 * part that means something.
 *
 * The mark is taller than it is wide (330×418), so it is sized by height and
 * allowed to find its own width rather than being forced into a square box.
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
    <Logo className={cn("h-6 w-auto", markClassName)} />
    <span className="text-[15px] font-semibold tracking-[-0.01em]">
      Round<span className="font-mono font-medium">Zero</span>
    </span>
  </span>
));
Wordmark.displayName = "Wordmark";
