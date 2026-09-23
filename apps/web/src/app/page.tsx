import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, Wordmark } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { Reveal } from "./(marketing)/reveal";
import { CountdownNumber } from "./(marketing)/countdown";
import { ROUND_ONE, daysUntil } from "./(marketing)/round-one";
import { DebriefDemo, TerminalDemo } from "./(marketing)/landing-visuals";

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
  ["124", "practice questions"],
  ["75", "checklist items"],
  ["7", "domains"],
  ["0", "cost"],
] as const;

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const cta = session ? "Open RoundZero" : "Start training";
  const days = daysUntil(ROUND_ONE);

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
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim transition-colors duration-standard ease-standard hover:text-text"
          >
            {session ? "Open app" : "Sign in"}
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-hairline">
        {/* The mark's own slash angle, as texture. Masked so it fades out
            rather than stopping at an edge — a hard boundary would read as a
            panel, and this is meant to feel like the page's grain. */}
        <div
          aria-hidden="true"
          className="brand-hatch pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(120%_80%_at_85%_0%,black,transparent_65%)]"
        />
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
                {/* "Round 1" moved to the countdown's own unit label below,
                    so this no longer says it twice. */}
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
                  CyberPatriot XIX
                </p>
              </Reveal>

              <Reveal delayMs={60}>
                <p className="mt-6 flex items-baseline gap-4 leading-[0.85] text-text">
                  {/* The oversized mark that used to sit behind this is gone:
                      at 1.5em it clipped off the viewport's left edge and cut
                      straight through the eyebrow above, and at that scale a
                      slashed zero reads as a plain circle anyway. The header
                      mark and the hatch motif carry the identity without it. */}
                  <span className="font-mono text-[clamp(84px,15vw,168px)] font-semibold tracking-[-0.05em]">
                    <CountdownNumber days={days} />
                  </span>
                  {/* Aligned to the numeral's baseline and given its own
                      leading — stacked against a 168px glyph it was reading
                      as cramped rather than as a unit label. */}
                  <span className="font-mono text-[13px] uppercase leading-[1.5] tracking-[0.14em] text-text-dim">
                    days
                    <br />
                    to Round&nbsp;1
                  </span>
                </p>
              </Reveal>

              <Reveal delayMs={120}>
                <h1 className="mt-10 max-w-lg text-[26px] font-semibold leading-[34px] text-text">
                  Every one of them is a week you could be a vulnerability
                  better.
                </h1>
              </Reveal>

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
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
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
              <Reveal key={label} delayMs={index * 50}>
                <div className="py-8 lg:px-6 lg:first:pl-0">
                  <dt className="font-mono text-[28px] font-semibold tabular-nums leading-none text-text">
                    {value}
                  </dt>
                  <dd className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
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
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
                The part that teaches
              </p>
            </Reveal>
            <Reveal delayMs={60}>
              <h2 className="mt-5 text-[clamp(30px,4vw,44px)] font-semibold leading-[1.08] tracking-[-0.02em] text-text">
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
            <h2 className="max-w-xl text-[clamp(30px,4vw,44px)] font-semibold leading-[1.08] tracking-[-0.02em] text-text">
              Built for one person getting better.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-px bg-hairline md:grid-cols-3">
            {CAPABILITIES.map((item, index) => (
              <Reveal key={item.n} delayMs={index * 70}>
                <div className="h-full bg-bg py-8 md:px-8 md:first:pl-0">
                  <p className="font-mono text-[11px] tracking-[0.14em] text-accent">
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
            <p className="max-w-3xl text-[clamp(32px,5.5vw,64px)] font-semibold leading-[1.05] tracking-[-0.03em] text-text">
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

      <footer>
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-4 px-6 py-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
            RoundZero · Independent · Open source
          </p>
          <p className="max-w-md text-[11px] leading-[18px] text-text-dim">
            Not affiliated with or endorsed by the Air &amp; Space Forces
            Association or CyberPatriot.
          </p>
        </div>
      </footer>
    </main>
  );
}
