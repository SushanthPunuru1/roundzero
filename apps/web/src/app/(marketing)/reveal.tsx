"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@roundzero/ui";

/**
 * Animates its children in when they scroll into view — WITHOUT ever being
 * the reason they are invisible.
 *
 * The distinction is the whole point and an earlier version got it wrong.
 * That version rendered `opacity-0` on the server and only removed it once
 * an observer fired, which meant the page was blank until JavaScript ran:
 * blank to a crawler, and blank on a throttled school Chromebook, which is
 * exactly the device `CLAUDE.md` says every feature must work on. A landing
 * page whose content depends on JS to *exist* is broken, however nice the
 * animation is.
 *
 * So the hidden state is applied only after mount. The server renders
 * visible markup; the client hides-then-reveals. Elements already on screen
 * are re-shown in the same commit the observer fires in, and anything off
 * screen is hidden where nobody can see the transition begin.
 *
 * IntersectionObserver rather than a scroll library: one behaviour on one
 * page, and golden rules 4 and 7 both point at using what the platform
 * already has.
 *
 * Reveals are one-way on purpose — content that re-hides when you scroll
 * back up reads as broken and punishes the reader for looking again.
 */
export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Stagger, for sequencing a few elements. Keep it under ~200ms total —
   * past that it stops reading as choreography and starts reading as lag. */
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /** False during SSR and the first client render, so the markup that ships
   * is visible. Only once this is true may anything be hidden. */
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      // Fire slightly before the element's edge clears the fold, so the
      // motion finishes as it arrives rather than starting once it has
      // already been read.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );

    observer.observe(node);
    setArmed(true);
    return () => observer.disconnect();
  }, []);

  const hidden = armed && !shown;

  return (
    <div
      ref={ref}
      style={{ transitionDelay: hidden ? "0ms" : `${delayMs}ms` }}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.2,0,0,1)]",
        hidden ? "motion-safe:translate-y-3 opacity-0" : "translate-y-0 opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}
