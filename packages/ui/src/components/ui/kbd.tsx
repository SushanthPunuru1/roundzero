import * as React from "react";

import { cn } from "../../lib/utils";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/** A keyboard-hint chip — "press X" affordances (drill ratings, future
 * command palette). Small radius, mono, matches inline-key sizing. */
function Kbd({ className, children, ...props }: KbdProps) {
  return (
    <kbd
      className={cn("rounded-[3px] border border-hairline bg-surface-2 px-1 py-0.5 font-mono", className)}
      {...props}
    >
      {children}
    </kbd>
  );
}

export { Kbd };
