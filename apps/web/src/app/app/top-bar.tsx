"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, cn } from "@roundzero/ui";

import { SignOutButton } from "./sign-out-button";

const NAV_LINKS = [
  { href: "/app/team", label: "Team" },
  { href: "/app/lessons", label: "Lessons" },
  { href: "/app/checklists", label: "Checklists" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopBar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 h-14 shrink-0 border-b border-hairline bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-[1100px] items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/app"
            className="flex items-center gap-2 rounded-[3px] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <span
              className="inline-block size-2 rounded-[3px] bg-accent"
              aria-hidden="true"
            />
            <span className="font-mono font-medium text-text">RoundZero</span>
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-4">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-14 items-center border-b-2 text-sm transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                    active
                      ? "border-accent text-text"
                      : "border-transparent text-text-dim hover:text-text",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
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
