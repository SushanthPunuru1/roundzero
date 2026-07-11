import * as React from "react";

import { cn } from "../../lib/utils";

export interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

function PageHeader({ eyebrow, title, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div>
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.06em] text-text-dim">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-1 text-[25px] font-semibold leading-[32px] text-text">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export { PageHeader };
