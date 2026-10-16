/**
 * The one footer, used by the marketing page and the signed-in app shell.
 *
 * Shared rather than inline because the middle line is a legal disclaimer,
 * and it previously existed only on `/`. A learner could sign in, work
 * through 54 lessons and never once see the statement that this project is
 * not affiliated with the Air & Space Forces Association — which is the only
 * place that statement actually needs to be seen.
 *
 * `print:hidden` for the same reason the top bar carries it: the checklist
 * export renders the "field datasheet" identity (DECISIONS 013) with its own
 * header, and app chrome has no business on that page.
 */
export function SiteFooter() {
  return (
    <footer className="print:hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-10">
        <p className="text-[11px] leading-[18px] text-text-dim">
          RoundZero · Free and open source · Built by Sushanth Punuru
        </p>
        {/* Capped to a readable measure so it wraps to two tidy lines instead
            of running the full 1152px container. */}
        <p className="max-w-md text-[11px] leading-[18px] text-text-dim">
          Not affiliated with or endorsed by the Air &amp; Space Forces
          Association or CyberPatriot.
        </p>
        {/* Mono: this line is metadata about the artifact rather than prose,
            which is the distinction DESIGN.md draws for the mono face. */}
        <p className="font-mono text-[11px] leading-[18px] text-text-dim">
          © 2026 Sushanth Punuru · MIT License
        </p>
      </div>
    </footer>
  );
}
