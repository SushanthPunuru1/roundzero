"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@roundzero/ui";

import { SignOutButton } from "./sign-out-button";

const CRUMBS: Record<string, string> = {
  "/app": "Set up",
  "/app/team": "Team",
};

function crumbFor(pathname: string): string | null {
  const exact = CRUMBS[pathname];
  if (exact) return exact;
  const match = Object.keys(CRUMBS).find((path) => pathname.startsWith(`${path}/`));
  return (match && CRUMBS[match]) || null;
}

export function TopBar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();
  const crumb = crumbFor(pathname);

  return (
    <header className="sticky top-0 z-10 h-14 shrink-0 border-b border-hairline bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-[1100px] items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-2 text-sm">
          <span
            className="inline-block size-2 rounded-[3px] bg-accent"
            aria-hidden="true"
          />
          <span className="font-mono font-medium text-text">RoundZero</span>
          {crumb && (
            <>
              <ChevronRight
                className="size-3.5 text-text-dim"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="text-text-dim">{crumb}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Avatar name={name} size="sm" />
          <span className="hidden text-sm text-text sm:inline" title={email}>
            {name}
          </span>
          <SignOutButton className="w-auto" size="sm" />
        </div>
      </div>
    </header>
  );
}
