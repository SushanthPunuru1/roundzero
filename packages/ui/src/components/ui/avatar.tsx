import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return "?";
  const second = words[1];
  if (!second) return first.slice(0, 2).toUpperCase();
  return (first.charAt(0) + second.charAt(0)).toUpperCase();
}

const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 font-medium text-text-dim",
  {
    variants: {
      size: {
        sm: "size-7 text-[11px]",
        md: "size-9 text-xs",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  name: string;
}

function Avatar({ name, size, className, ...props }: AvatarProps) {
  return (
    <span
      className={cn(avatarVariants({ size, className }))}
      aria-hidden="true"
      {...props}
    >
      {initials(name)}
    </span>
  );
}

export { Avatar, avatarVariants };
