"use client";

import { useEffect, useRef } from "react";

/**
 * A drifting dot lattice sheared along the logo's own 124° slash angle.
 *
 * This is the one piece of "graphics" on the site, and it is deliberately
 * small. The references that prompted it (Active Theory, Orano) are
 * full-viewport WebGL scenes; Active Theory's entire page is a single canvas
 * with essentially no DOM, which has no keyboard path and no screen-reader
 * text. `DESIGN.md`'s quality floor requires both, and golden rule 5 requires
 * the whole thing to run on a locked-down school Chromebook. So: a hand-
 * written 2D canvas, no Three.js, no new dependency (golden rule 7), and the
 * page is complete and correct with this element removed entirely.
 *
 * Three guards, because a background texture must never cost someone their
 * battery or their frame rate:
 *   - `prefers-reduced-motion` renders one static frame and stops
 *   - a device reporting ≤2 cores renders one static frame and stops
 *   - the animated path is capped at ~30fps rather than running at display
 *     refresh, which on a 120Hz panel would be 4x the work for no gain
 *
 * `aria-hidden` throughout: it carries no information.
 */
export function BrandField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const weak = (navigator.hardwareConcurrency ?? 4) <= 2;
    const still = reduce || weak;

    const ANGLE = (124 * Math.PI) / 180;
    const STEP = 42;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let dots: { x: number; y: number; phase: number }[] = [];
    let w = 0;
    let h = 0;
    let frame = 0;

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const shearX = Math.cos(ANGLE) * STEP;
      const rowY = Math.abs(Math.sin(ANGLE) * STEP);
      dots = [];
      for (let col = -14; col * STEP < w + STEP * 14; col++) {
        for (let row = -4; row * rowY < h + rowY * 4; row++) {
          dots.push({
            x: col * STEP + row * shearX * 0.42,
            y: row * rowY * 0.9,
            // Random phase so the field shimmers rather than pulsing as one
            // sheet, which reads as a flashing panel.
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    };

    const paint = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#98A1AE";
      for (const dot of dots) {
        if (dot.x < -20 || dot.x > w + 20 || dot.y < -20 || dot.y > h + 20) continue;
        const pulse = still ? 0.5 : (Math.sin(t / 1900 + dot.phase) + 1) / 2;
        ctx.globalAlpha = 0.16 + pulse * 0.34;
        ctx.fillRect(dot.x, dot.y, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    };

    build();
    paint(0);

    if (!still) {
      let last = 0;
      const loop = (now: number) => {
        if (now - last > 33) {
          paint(now);
          last = now;
        }
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }

    const onResize = () => {
      build();
      paint(performance.now());
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
