import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "../../lib/utils";

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Explicit-border box rather than the UA-painted control, so the same
 * component reads correctly both as a dark-theme UI checkbox and as an empty
 * box on the print datasheet (checked state is never set on print — teams
 * check it with a pen).
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <span className={cn("relative inline-flex size-4 shrink-0", className)}>
        <input
          type="checkbox"
          ref={ref}
          className="peer size-4 shrink-0 appearance-none rounded-sm border border-hairline bg-surface outline-none transition-colors duration-standard ease-standard checked:border-accent checked:bg-accent disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          {...props}
        />
        <Check
          className="pointer-events-none absolute inset-0 size-4 scale-0 text-bg transition-transform duration-standard ease-standard peer-checked:scale-100"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </span>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
