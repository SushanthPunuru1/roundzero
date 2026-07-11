import * as React from "react";

import { cn } from "../../lib/utils";

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}

function Stat({ label, value, className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] uppercase tracking-[0.06em] text-text-dim">
        {label}
      </span>
      <span className="font-mono text-sm tabular-nums text-text">{value}</span>
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
