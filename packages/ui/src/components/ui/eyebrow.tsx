import * as React from "react";

import { cn } from "../../lib/utils";

export interface EyebrowProps extends React.HTMLAttributes<HTMLElement> {
  /** The rendered element — `h2` for a section heading, `div`/`p` (default)
   * for a plain label. Purely semantic; the visual treatment never changes. */
  as?: React.ElementType;
  children: React.ReactNode;
}

/**
 * The system's one small-caps label style — 11px, tracked +0.06em, --text-dim
 * (DESIGN.md: "Sentence case everywhere. No all-caps except tiny eyebrow
 * labels"). Used for page-header eyebrows, StatStrip labels, section
 * headings, and inline micro-labels alike, so every one of those reads as
 * the same system instead of a dozen hand-copied class strings.
 */
function Eyebrow({ as: Component = "p", className, children, ...props }: EyebrowProps) {
  return (
    <Component
      className={cn("text-[11px] uppercase tracking-[0.06em] text-text-dim", className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export { Eyebrow };
