import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../../lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  message: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

function EmptyState({ icon: Icon, message, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-md border border-hairline bg-surface px-8 py-12 text-center",
        className,
      )}
    >
      <Icon className="size-8 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
      <p className="max-w-sm text-sm text-text-dim">{message}</p>
      {action}
    </div>
  );
}

export { EmptyState };
