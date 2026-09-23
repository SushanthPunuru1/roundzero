"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Wordmark, cn } from "@roundzero/ui";

import { SignOutButton } from "./sign-out-button";

/**
 * The signed-in shell. Every screen in the product sits inside this, which is
 * why it was the first thing the design pass touched.
 *
 * Three things were wrong with the version this replaces:
 *
 * 1. It hand-rolled the brand as `<span className="size-2 rounded-[3px]
 *    bg-accent" />` — a small orange square — while `packages/ui` exported a
 *    real `Wordmark` with the slashed-zero mark. So a signed-in user was not
 *    looking at a less-polished version of the landing page; they were
 *    looking at a different product. That is golden rule 3 broken in the one
 *    component nothing can avoid.
 * 2. The mark linked to `/app`, so once signed in the landing page was
 *    unreachable. It now links home, and "Dashboard" is a nav item instead.
 * 3. Nine flat links with `Team` leading them — the dormant feature (see
 *    CLAUDE.md's scope section) was the most prominent item in the nav of an
 *    individual-first product.
 */

/**
 * Grouped, not flat. Nine equal links read as a menu; three groups read as a
 * console, which is the direction DESIGN.md actually asks for. The groups are
 * separated by a hairline rather than a dropdown so nothing here needs a menu
 * primitive that `packages/ui` does not have yet.
 *
 * `Team` is deliberately absent. Its route and roster keep working —
 * CLAUDE.md says teams are dormant, not deleted — and the dashboard still
 * links to it, so it is reachable without leading anything. `Placement` is
 * absent too: it is a one-time action the dashboard already surfaces, not a
 * destination worth permanent real estate.
 */
const NAV_GROUPS = [
  [{ href: "/app", label: "Dashboard", exact: true }],
  [
    { href: "/app/lessons", label: "Lessons" },
    { href: "/app/drill", label: "Drill" },
  ],
  [
    { href: "/app/forensics", label: "Forensics" },
    { href: "/app/networking", label: "Networking" },
    { href: "/app/subnetting", label: "Subnetting" },
    { href: "/app/lab", label: "Lab" },
  ],
  [{ href: "/app/checklists", label: "Checklists" }],
] as const;

function isActive(
  pathname: string,
  href: string,
  exact?: boolean,
): boolean {
  // `/app` would otherwise light up on every screen, since every route is
  // prefixed with it.
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopBar({
  name,
  email,
  dueCount = 0,
}: {
  name: string;
  email: string;
  dueCount?: number;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 h-14 shrink-0 border-b border-hairline bg-bg/95 backdrop-blur-sm print:hidden">
      <div className="mx-auto flex h-full max-w-[1100px] items-center justify-between gap-4 px-6">
        {/* `grow`, not `flex-1`. Under `justify-between` this group would only
            take the width it needs, so any space freed on the right became a
            gap in the middle instead of reaching the nav — which is why the
            nav clipped "Checklists" mid-word while 100px sat unused beside it.
            `flex-1` is wrong here too: it sets flex-basis to 0 and, with
            `min-w-0` on the nav, collapses the whole group to nothing. */}
        <div className="flex min-w-0 grow items-center gap-5">
          <Link
            href="/"
            aria-label="RoundZero home page"
            className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Wordmark />
          </Link>

          {/* Scrolls horizontally rather than wrapping or clipping. On the
              locked-down school Chromebook of golden rule 5 the viewport is
              narrow, and the old bar simply overflowed — links existed but
              could not be reached. The scrollbar itself is hidden because the
              row is 14px tall; the links remain keyboard-reachable, which is
              what actually matters. */}
          <nav
            aria-label="Primary"
            className="flex min-w-0 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {NAV_GROUPS.map((group, groupIndex) => (
              <div key={groupIndex} className="flex items-center">
                {groupIndex > 0 && (
                  <span
                    aria-hidden="true"
                    className="mx-1.5 h-4 w-px shrink-0 bg-hairline"
                  />
                )}
                {group.map((link) => {
                  const active = isActive(
                    pathname,
                    link.href,
                    "exact" in link ? link.exact : undefined,
                  );
                  const showDue = link.href === "/app/drill" && dueCount > 0;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-14 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2 text-sm transition-colors duration-standard ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
                        active
                          ? "border-accent text-text"
                          : "border-transparent text-text-dim hover:bg-surface hover:text-text",
                      )}
                    >
                      {link.label}
                      {showDue && (
                        <span className="rounded-sm border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-accent">
                          {dueCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Avatar only — the name is deliberately not repeated beside it.
            Measured on the deployed page: nine nav items, the mark, a name
            and a sign-out button need ~682px of the 1100px container's
            ~667px. Tuning padding got that to exactly zero slack, which is
            the same bug one character away; a longer display name or a
            three-digit due badge re-broke it every time.

            So something had to go, and the name is the lowest information
            per pixel in the row: the avatar already encodes identity from
            the same string, and `title` carries both name and email on
            hover for the shared-Chromebook case. Dropping it returns ~119px,
            which is real headroom rather than a lucky fit. */}
        <div className="flex shrink-0 items-center gap-3">
          <Avatar name={name} size="sm" title={`${name} · ${email}`} />
          <SignOutButton className="w-auto" size="sm" />
        </div>
      </div>
    </header>
  );
}
