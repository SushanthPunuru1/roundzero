"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@roundzero/ui";

/**
 * Reveals its children once, when they scroll into view.
 *
 * IntersectionObserver rather than a scroll library: this is one behaviour on
 * one page, and `CLAUDE.md` golden rules 4 and 7 both point the same way —
 * no dependency for something the platform already does.
 *
 * Reveals are one-way on purpose. Content that re-hides when you scroll back
 * up reads as broken, and it punishes the reader for looking again.
 *
 * `prefers-reduced-motion` is handled twice over: the global block in
 * globals.css collapses the transition to instant, and the observer still
 * fires, so the content is always *present* — never hidden behind an
 * animation that never runs. Motion is the enhancement; visibility is not.
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
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Already on screen at mount (above the fold, or a reload mid-page):
    // show immediately rather than waiting for a scroll that may never come.
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
      // motion finishes as it arrives rather than starting once it's already
      // been read.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delayMs}ms` : "0ms" }}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.2,0,0,1)]",
        shown ? "translate-y-0 opacity-100" : "motion-safe:translate-y-3 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
