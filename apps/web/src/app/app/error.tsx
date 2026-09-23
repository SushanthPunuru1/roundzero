"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LayoutDashboard, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@roundzero/ui";

/**
 * The error boundary for every screen under /app.
 *
 * Next requires this to be a client component — it is a real React error
 * boundary, and `reset` re-renders the segment in place. Without one, a
 * thrown server action or a failed query renders Next's built-in fallback:
 * a bare, unstyled "Application error: a client-side exception has occurred"
 * on a white page. For a platform whose whole pitch is that it explains what
 * went wrong, that is the worst screen we could ship.
 *
 * It sits INSIDE the app layout, so the top bar survives and the user still
 * has navigation — an error boundary that swallows the chrome strands them
 * on a dead page with nothing but the back button.
 *
 * `error.message` is deliberately not rendered. In production Next replaces
 * it with a generic string anyway, and in development it can carry query
 * fragments and user rows — `CLAUDE.md` rule 8 says minors use this platform
 * and personal data must not leak into surfaces or logs. `digest` is the
 * server-side hash Next *does* expose on purpose: it's the one token that
 * lets a report be matched to a log line, and it contains nothing else.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Console only, and only the digest and name. Deliberately not the
    // message or the stack: this runs in the user's browser, where anything
    // printed is visible in a shared-screen classroom.
    console.error("[roundzero] render failed", {
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-hairline bg-surface px-8 py-16 text-center">
      <TriangleAlert className="size-8 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
      <div>
        <h1 className="text-[19px] font-semibold leading-7 text-text">
          This screen didn&apos;t load
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-dim">
          Something failed on our side, not yours. Your progress is saved —
          nothing you&apos;ve completed is affected by this.
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Try again
        </Button>
        <Button asChild variant="ghost">
          <Link href="/app">
            <LayoutDashboard className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Back to dashboard
          </Link>
        </Button>
      </div>

      {error.digest && (
        <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-dim">
          Reference {error.digest}
        </p>
      )}
    </div>
  );
}
