import * as React from "react";

import { cn } from "../../lib/utils";
import { Eyebrow } from "./eyebrow";

export interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** One-line description under the title — the `<p class="mt-1 text-sm
   * text-text-dim">` every screen was repeating by hand. */
  support?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

function PageHeader({ eyebrow, title, support, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div>
        {eyebrow && <Eyebrow as="div">{eyebrow}</Eyebrow>}
        <h1 className="mt-1 text-[25px] font-semibold leading-[32px] text-text">
          {title}
        </h1>
        {support && <p className="mt-1 text-sm text-text-dim">{support}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export { PageHeader };
