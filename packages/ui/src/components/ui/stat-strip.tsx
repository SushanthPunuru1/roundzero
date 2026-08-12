import * as React from "react";

import { cn } from "../../lib/utils";
import { Eyebrow } from "./eyebrow";

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /**
   * Whether the value is machine data (mono, tabular-nums) or prose.
   * Defaults to true because most Stats are counts.
   *
   * Set false for a value that is a NAME rather than a number — a lesson
   * title typeset in mono with tabular figures reads as machine output and
   * gets the letter-spacing of a serial number. DESIGN.md scopes mono to
   * "anything from the machine's world", which a lesson title is not.
   */
  mono?: boolean;
  className?: string;
}

function Stat({ label, value, mono = true, className }: StatProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Eyebrow as="span">{label}</Eyebrow>
      <span
        className={cn(
          "min-w-0 text-sm text-text",
          mono ? "font-mono tabular-nums" : "truncate font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export interface StatStripProps {
  children: React.ReactNode;
  className?: string;
}

function StatStrip({ children, className }: StatStripProps) {
  const items = React.Children.toArray(children);
  return (
    <div className={cn("flex flex-wrap gap-x-8 gap-y-4", className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            // min-w-0 so a Stat with a prose (non-mono) value can actually
            // truncate — a flex item defaults to min-width:auto, which would
            // let a long lesson title stretch the strip instead.
            "min-w-0",
            index > 0 && "border-l border-hairline pl-8",
          )}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

export { Stat, StatStrip };
