import * as React from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "../../lib/utils";

export interface ErrorNoteProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * The one bordered-note treatment for a recoverable error message —
 * AlertCircle + text in a `bg-surface-2` panel. Deliberately neutral, not
 * `--penalty`: DESIGN.md reserves that token for scoring semantics, and a
 * form/action error here isn't a competition penalty.
 */
function ErrorNote({ children, className }: ErrorNoteProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-hairline bg-surface-2 p-3",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
      <p className="text-sm text-text">{children}</p>
    </div>
  );
}

export { ErrorNote };
