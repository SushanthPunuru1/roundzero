import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button, Wordmark } from "@roundzero/ui";

/**
 * The global 404: any URL that matches no route at all.
 *
 * This one renders in the root layout, NOT the app shell, so it has to carry
 * its own header — a visitor who mistypes a link may never have signed in,
 * and dropping them on a page with no mark and no way forward is how a free
 * tool gets mistaken for a dead one.
 *
 * Centered and short on purpose. There is nothing to explain here and no
 * action worth offering beyond "go somewhere that exists".
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
            <Wordmark />
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
        <SearchX className="size-8 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
            404
          </p>
          <h1 className="mt-2 text-[25px] font-semibold leading-8 text-text">
            There&apos;s nothing at this address
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-dim">
            The page may have moved, or the link may have been mistyped.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link href="/app">Open RoundZero</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Back to the home page</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
