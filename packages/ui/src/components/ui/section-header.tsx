import * as React from "react";

import { cn } from "../../lib/utils";

export interface SectionHeaderProps {
  title: React.ReactNode;
  /** One line under the title, same role as PageHeader's `support`. */
  support?: React.ReactNode;
  /** Trailing element on the title row — a count, a link, a filter. Sits
   * right-aligned and baseline-adjacent to the title. */
  aside?: React.ReactNode;
  className?: string;
}

/**
 * The heading for a section WITHIN a page — the tier between PageHeader's
 * 25/32 page title and body copy. DESIGN.md's type scale calls this
 * "20/28 section title"; nothing rendered it until now.
 *
 * Screens were using `<Eyebrow as="h2">` as a section heading, which made the
 * heading an 11px caps label — visually SMALLER than the 14px support line
 * beneath it, inverting the hierarchy the screen-craft checklist asks for
 * ("eyebrow / title / support line read in that order at a glance").
 * Eyebrow stays what it is: a micro-label, not a heading.
 */
function SectionHeader({ title, support, aside, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1", className)}>
      <div className="min-w-0">
        <h2 className="text-[20px] font-semibold leading-[28px] text-text">{title}</h2>
        {support && <p className="mt-1 text-sm text-text-dim">{support}</p>}
      </div>
      {aside && <div className="shrink-0 text-sm text-text-dim">{aside}</div>}
    </div>
  );
}

export { SectionHeader };
