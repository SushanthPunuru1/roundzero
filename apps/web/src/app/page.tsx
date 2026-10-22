import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, Wordmark } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { Reveal } from "./(marketing)/reveal";
import { CountdownNumber } from "./(marketing)/countdown";
import { ROUND_ONE, daysUntil, roundPhase } from "./(marketing)/round-one";
import { DebriefDemo, TerminalDemo } from "./(marketing)/landing-visuals";
import { BrandField } from "./(marketing)/brand-field";
import { SiteFooter } from "@/components/site-footer";

/* Marketing surface. DESIGN.md's type scale tops out at 32/40 "display
   (marketing only)" — this page goes past it deliberately, and it is the only
   place allowed to. The whole idea is a ratio the app never needs: a
   ~150px numeral against an 11px label. Inside /app, the scale still binds. */

const CAPABILITIES = [
  {
    n: "01",
    // Was "Placement, not a firehose". "Drinking from a firehose" is American
    // business idiom for being swamped — opaque to a 14-year-old, which is
    // most of this audience, and against DESIGN.md's "plain verbs, zero
    // filler". It also broke the set: its two siblings are plain noun phrases
    // and this one was an "X, not Y" construction. The anti-firehose point
    // survives in the body's last sentence, in words anyone can read.
    title: "A track shaped to you",
    body: "A short adaptive check sets your level per domain and builds a track from it. You start where you actually are.",
  },
  {
    n: "02",
    title: "Repetition that remembers",
    body: "Finish a lesson and its cards enter an FSRS rotation. Miss a forensics question and it returns until it stops being missed.",
  },
  {
    n: "03",
    title: "References you own",
    body: "Fork the Linux and Windows checklists. Items you edit are yours; items you leave alone keep inheriting upstream corrections.",
  },
];

const INVENTORY = [
  ["54", "lessons"],
  ["265", "drill cards"],
  // "practice questions" cannot fit a 1/6 column at any padding worth having
  // — measured on the deployed page, it wrapped even at 8px. "drill cards" is
  // already its own entry above, so there is nothing for "questions" to be
  // confused with here.
  ["124", "questions"],
  ["75", "checklist items"],
  ["7", "domains"],
  ["0", "cost"],
] as const;

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const cta = session ? "Open RoundZero" : "Start training";
  const days = daysUntil(ROUND_ONE);
  const phase = roundPhase();

  return (
    <main className="flex-1">
      {/* --- Hero: the countdown carries it -------------------------------
          Asymmetric on purpose. Content sits on a left axis with a wide
          right gutter that the terminal bleeds into — a centered column is
          the thing that made the last version read as a template. */}
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Wordmark />
          <Link
            href="/app"
            className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-dim transition-colors duration-standard ease-standard hover:text-text"
          >
            {session ? "Open app" : "Sign in"}
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-hairline">
        {/* Layer 1 — the drifting lattice, furthest back. Masked toward the
            upper right so it reads as atmosphere behind the headline rather
            than as a pattern the text is sitting on top of. */}
        <BrandField className="pointer-events-none absolute inset-0 size-full opacity-[0.85] [mask-image:radial-gradient(120%_90%_at_78%_8%,black_10%,transparent_68%)]" />

        {/* Layer 2 — five full-height structural rules. The single biggest
            thing the Orano reference does that this page did not: it makes
            the frame read as engineered rather than as a column of content
            that happens to be centered. Pure CSS, no cost. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid grid-cols-2 md:grid-cols-5"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="border-r border-hairline/55 last:border-r-0"
            />
          ))}
        </div>
        {/* Tighter top: the old pt-28 left a band of dead space above the
            eyebrow, and centering the two columns makes the countdown read
            against the terminal rather than floating above it. */}
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-20">
          {/* items-stretch, not items-center. Centered, the terminal sat as a
              short card floating in the middle of a tall column, leaving a
              ~120px void above and below it — the bottom-right quadrant of
              the hero read as unfinished. Stretched, the two columns are two
              solid masses, and a terminal whose output sits at the bottom of
              a taller frame is simply what a terminal looks like. */}
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-stretch lg:gap-14">
            <div>
              <Reveal>
                {/* Tracked far wider than the standard 0.06em eyebrow. At
                    11px above a 70px all-caps headline the default reads as a
                    caption that drifted up; this reads as a label on an
                    instrument. Marketing surface only — DESIGN.md's
                    typography section says where this is allowed. */}
                <p className="font-mono text-[11px] uppercase tracking-[0.34em] text-text-dim">
                  CyberPatriot XIX
                </p>
              </Reveal>

              {/* Headline first now, countdown second. The countdown used to
                  lead, which made the page about a date; the product is not
                  the date. All-caps at display size is the one place
                  DESIGN.md's sentence-case rule is suspended (DECISIONS 055)
                  — the treatment needs short declarative lines, and the old
                  sentence at 70px was a wall of text. */}
              <Reveal delayMs={60}>
                <h1 className="display-wide mt-7 max-w-[15ch] text-[clamp(34px,5.4vw,70px)] font-medium uppercase leading-[1.04] text-text">
                  Train for the <span className="text-accent">round</span>, not
                  the score
                </h1>
              </Reveal>

              {/* The countdown only exists while there is something to count
                  to. Once Round 1 opened, "0 DAYS TO ROUND 1" sat on the hero
                  looking like the page had been abandoned — so the numeral is
                  dropped after the window and the headline carries the hero
                  on its own. */}
              {phase !== "after" && (
                <Reveal delayMs={120}>
                  <p className="mt-9 flex items-baseline gap-4 leading-[0.9] text-text">
                    {/* Smaller than the old 168px: it is the second element
                        in the hero now, not the first, and at full size it
                        shouted over the headline above it. */}
                    <span className="font-mono text-[clamp(44px,6vw,78px)] font-semibold tracking-[-0.03em]">
                      {phase === "during" ? "NOW" : <CountdownNumber days={days} />}
                    </span>
                    <span className="font-mono text-[11px] uppercase leading-[1.7] tracking-[0.2em] text-text-dim">
                      {phase === "during" ? (
                        <>
                          Round&nbsp;1
                          <br />
                          Oct 22&ndash;25
                        </>
                      ) : (
                        <>
                          days
                          <br />
                          to Round&nbsp;1
                        </>
                      )}
                    </span>
                  </p>
                </Reveal>
              )}

              <Reveal delayMs={160}>
                <p className="mt-4 max-w-md text-[15px] leading-[24px] text-text-dim">
                  Most practice hands you a score. RoundZero names what you
                  missed, explains why it mattered, and puts it back in front
                  of you next week.
                </p>
              </Reveal>

              <Reveal delayMs={220}>
                <div className="mt-9 flex flex-wrap items-center gap-4">
                  <Button asChild size="lg">
                    <Link href="/app">
                      {cta}
                      <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    </Link>
                  </Button>
                  <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-dim">
                    Free · No team needed
                  </p>
                </div>
              </Reveal>
            </div>

            {/* Bleeds past the container edge on wide screens. */}
            <Reveal delayMs={280} className="lg:-mr-24 lg:h-full xl:-mr-40">
              <TerminalDemo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* --- Inventory strip: dense mono data, not floating cards --------
          Contained, matching every other section. A previous pass made this
          full-bleed to cure an "unfinished" look, but that look was just the
          normal container margin — and edge-to-edge here left the data band
          running the full width while its neighbors sat ~400px in, which
          reads far worse than the thing it fixed. */}
      <section className="border-b border-hairline">
        <div className="mx-auto max-w-6xl px-6">
          <dl className="grid grid-cols-2 divide-hairline sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
            {INVENTORY.map(([value, label], index) => (
              // Padding lives on the Reveal, not on the div inside it.
              // `first:` resolves against the element's PARENT, and the inner
              // div is always the only child of its Reveal — so `first:pl-0`
              // matched all six cells instead of one, and every label sat
              // flush against the divider to its left. The Reveal is the real
              // grid child, so the variant works here.
              <Reveal
                key={label}
                delayMs={index * 50}
                className="py-8 lg:px-3 lg:first:pl-0"
              >
                <div>
                  <dt className="font-mono text-[28px] font-semibold tabular-nums leading-none text-text">
                    {value}
                  </dt>
                  <dd className="mt-2 font-mono text-[11px] uppercase tracking-[0.06em] text-text-dim">
                    {label}
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* --- The debrief -------------------------------------------------- */}
      <section className="border-b border-hairline">
        <div className="mx-auto grid max-w-6xl gap-14 px-6 py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
          <div>
            <Reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-dim">
                The part that teaches
              </p>
            </Reveal>
            <Reveal delayMs={60}>
              <h2 className="display-tight mt-5 text-[clamp(30px,4vw,44px)] font-semibold leading-[1.08] text-text">
                A score is a number.
                <br />
                A debrief is a lesson.
              </h2>
            </Reveal>
            <Reveal delayMs={120}>
              <p className="mt-5 max-w-sm text-[15px] leading-[24px] text-text-dim">
                Every check you missed comes back named, explained, and linked
                to the lesson that covers it — then queued into your review
                rotation so it isn&apos;t missed twice.
              </p>
            </Reveal>
          </div>
          <Reveal delayMs={100}>
            <DebriefDemo />
          </Reveal>
        </div>
      </section>

      {/* --- Capabilities: numbered, left-ruled, no card chrome ---------- */}
      <section className="border-b border-hairline">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <h2 className="display-tight max-w-xl text-[clamp(30px,4vw,44px)] font-semibold leading-[1.08] text-text">
              Built for one person getting better.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-px bg-hairline md:grid-cols-3">
            {CAPABILITIES.map((item, index) => (
              // Same `first:`-through-a-wrapper bug as the inventory strip
              // above. `bg-bg` moves up with the padding too: this grid draws
              // its dividers as `gap-px` over a `bg-hairline` parent, so the
              // fill has to cover the whole cell — left on the inner div it
              // would stop at the padding edge and leak hairline into the gap.
              <Reveal
                key={item.n}
                delayMs={index * 70}
                className="h-full bg-bg py-8 md:px-8 md:first:pl-0"
              >
                <div>
                  <p className="font-mono text-[11px] tracking-[0.06em] text-accent">
                    {item.n}
                  </p>
                  <h3 className="mt-5 text-[17px] font-semibold leading-[24px] text-text">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[14px] leading-[22px] text-text-dim">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* --- Close -------------------------------------------------------- */}
      <section className="border-b border-hairline">
        <div className="mx-auto max-w-6xl px-6 py-28">
          <Reveal>
            <p className="display-tight max-w-3xl text-[clamp(32px,5.5vw,64px)] font-semibold leading-[1.05] text-text">
              You can&apos;t practice the round.
              <br />
              <span className="text-accent">You can practice everything in it.</span>
            </p>
          </Reveal>
          <Reveal delayMs={100}>
            <div className="mt-10">
              <Button asChild size="lg">
                <Link href="/app">
                  {cta}
                  <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
