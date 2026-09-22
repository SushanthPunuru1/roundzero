import Link from "next/link";
import { LayoutDashboard, SearchX } from "lucide-react";
import { Button } from "@roundzero/ui";

/**
 * Handles every `notFound()` thrown under /app — six of them today, in the
 * lesson, forensics, networking and checklist routes. Without this file all
 * six fell through to Next's built-in 404: a bare "This page could not be
 * found" on a white page, outside the app shell, with no way back except the
 * browser's back button.
 *
 * Rendering it here keeps the top bar, so a mistyped or stale URL costs a
 * click rather than an exit.
 *
 * Shaped to match `error.tsx` beside it, deliberately — the two are the same
 * kind of moment and should not look like two different products. It is
 * composed rather than built on `EmptyState` for one reason: EmptyState puts
 * its `message` inside a `<p>`, and the title here needs to be a real `<h1>`
 * so this reads as a page rather than as a notice inside one. Every class is
 * a DESIGN.md token; nothing new is introduced.
 *
 * The copy names the likely cause. Almost none of these are typos — they are
 * bookmarks to content that was renamed, or a checklist fork that belongs to
 * a team the user has left. "Check the URL" would be useless advice for all
 * of those.
 */
export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-hairline bg-surface px-8 py-16 text-center">
      <SearchX className="size-8 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
      <div>
        <h1 className="text-[19px] font-semibold leading-7 text-text">
          We couldn&apos;t find that
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-dim">
          It may have been renamed, or it may belong to someone else.
          Everything you can open is one click away.
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/app">
            <LayoutDashboard className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Back to dashboard
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/app/lessons">Browse lessons</Link>
        </Button>
      </div>
    </div>
  );
}
