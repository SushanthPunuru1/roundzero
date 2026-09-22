"use client";

import { useEffect } from "react";
import Link from "next/link";
import { House, RotateCcw, TriangleAlert } from "lucide-react";
import { Button, Wordmark } from "@roundzero/ui";

/**
 * The error boundary for everything outside /app — the landing page, sign-in
 * and the magic-link callback.
 *
 * Sign-in is the one that matters. A failure there is the first thing a new
 * user ever sees of RoundZero, and Next's default fallback is an unstyled
 * white page reading "Application error". This at least fails in the
 * product's own voice and offers a retry.
 *
 * See `app/app/error.tsx` for why `error.message` is never rendered and only
 * `digest` is surfaced.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[roundzero] render failed", {
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Wordmark />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
        <TriangleAlert className="size-8 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
        <div>
          <h1 className="text-[25px] font-semibold leading-8 text-text">
            Something went wrong
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-dim">
            This is on our side. Trying again usually works — if it
            doesn&apos;t, the problem is ours to fix, not yours to work
            around.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Try again
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">
              <House className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Home
            </Link>
          </Button>
        </div>
        {error.digest && (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
            Reference {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
