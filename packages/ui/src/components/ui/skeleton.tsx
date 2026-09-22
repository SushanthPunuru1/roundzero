import * as React from "react";

import { cn } from "../../lib/utils";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * A placeholder block for content that hasn't arrived yet.
 *
 * `bg-surface-2` rather than a lighter shimmer color: DESIGN.md has no
 * "skeleton grey", and surface-2 is already the token for a raised-but-inert
 * area. Nothing here introduces a new value.
 *
 * Always `aria-hidden`. A screen reader must not be asked to interpret the
 * shape of a loading state — the announcement belongs on the container, which
 * every `loading.tsx` marks with `role="status"` and an accessible name. A
 * skeleton that announces itself reads out a dozen meaningless "blank"s.
 *
 * The pulse is `motion-safe:` only. A page of blocks throbbing at 2Hz is
 * exactly the kind of thing prefers-reduced-motion exists to stop, and a
 * static block still reads unmistakably as "not loaded yet".
 */
function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-sm bg-surface-2 motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}

export { Skeleton };
