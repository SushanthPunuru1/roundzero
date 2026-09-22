import { Skeleton } from "@roundzero/ui";

/**
 * The streaming fallback for every screen under /app.
 *
 * Deliberately generic. Next resolves `loading.tsx` by walking up from the
 * segment being rendered, so this one file stands in for the dashboard, the
 * lesson index, checklists, forensics and networking alike — and a skeleton
 * shaped like the dashboard would be a lie on five of those six. What they
 * genuinely share is a page header followed by a stack of full-width rows,
 * so that is what this draws.
 *
 * It does NOT cover the app layout itself. `layout.tsx` awaits the session
 * and the due-card count before it renders, and a segment's loading.tsx is
 * the fallback for that layout's *children*. So the top bar paints first and
 * this fills the space beneath it — the shell stays put across navigations
 * instead of the whole window blanking.
 */
export default function AppLoading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex flex-col gap-8"
    >
      {/* Page header: eyebrow, title, support line. Widths are the measured
          averages of the real headers, not round numbers, so the swap to
          real content doesn't visibly jump. */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        {/* Three rows, not ten. A skeleton's job is to reserve the shape of
            the page, not to guess its length — over-drawing rows that never
            arrive is its own kind of layout shift. */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[72px] w-full rounded-md" />
          <Skeleton className="h-[72px] w-full rounded-md" />
          <Skeleton className="h-[72px] w-full rounded-md" />
        </div>
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
