"use client";

import * as React from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

import { cn } from "../../lib/utils";

export type TerminalFrameStatus = "idle" | "connecting" | "ready" | "stopped" | "error";

export interface TerminalFrameHandle {
  write(data: string | Uint8Array): void;
  clear(): void;
  focus(): void;
  fit(): void;
}

export interface TerminalFrameProps {
  status: TerminalFrameStatus;
  title: string;
  subtitle?: string;
  onData?: (data: string) => void;
  onResize?: (size: { cols: number; rows: number }) => void;
  className?: string;
}

const STATUS_LABEL: Record<TerminalFrameStatus, string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  ready: "Connected",
  stopped: "Stopped",
  error: "Connection error",
};

// xterm renders to a <canvas>, whose 2D context needs a resolved color
// string — `var(--token)` isn't valid there the way it is for DOM/Tailwind
// classes, so this frame's own background/foreground/cursor/selection are
// the literal DESIGN.md token hexes (not new colors — the same ones,
// resolved). The 16-slot ANSI palette (a shell's own `ls --color`,
// prompt colors, etc.) is deliberately left as xterm's built-in default:
// that's the machine's own color language, not a RoundZero UI decoration,
// and --score/--penalty stay reserved for scoring per DESIGN.md.
const XTERM_THEME = {
  background: "#0b0d11",
  foreground: "#e8eaf0",
  cursor: "#e8a33d",
  cursorAccent: "#0b0d11",
  selectionBackground: "#e8a33d40",
};

const STATUS_DOT: Record<TerminalFrameStatus, string> = {
  idle: "bg-text-dim",
  connecting: "bg-accent",
  ready: "bg-accent",
  stopped: "bg-text-dim",
  error: "bg-penalty",
};

/**
 * The xterm.js wrapper shell — "from the machine's world" chrome around a
 * live terminal. Pure UI primitive: it owns the Terminal instance and
 * exposes write/clear/focus/fit via ref, but never opens a socket itself —
 * callers (apps/web's lab console) wire onData/write to whatever transport
 * they're using.
 */
const TerminalFrame = React.forwardRef<TerminalFrameHandle, TerminalFrameProps>(
  ({ status, title, subtitle, onData, onResize, className }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const termRef = React.useRef<Terminal | null>(null);
    const fitAddonRef = React.useRef<FitAddon | null>(null);
    const onDataRef = React.useRef(onData);
    const onResizeRef = React.useRef(onResize);
    onDataRef.current = onData;
    onResizeRef.current = onResize;

    React.useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const term = new Terminal({
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        theme: XTERM_THEME,
        allowProposedApi: true,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      const dataDisposable = term.onData((data) => onDataRef.current?.(data));

      const fitAndReport = () => {
        try {
          fitAddon.fit();
        } catch {
          return;
        }
        onResizeRef.current?.({ cols: term.cols, rows: term.rows });
      };
      fitAndReport();

      const resizeObserver = new ResizeObserver(() => fitAndReport());
      resizeObserver.observe(container);

      return () => {
        dataDisposable.dispose();
        resizeObserver.disconnect();
        term.dispose();
        termRef.current = null;
        fitAddonRef.current = null;
      };
    }, []);

    React.useImperativeHandle(
      ref,
      () => ({
        write(data) {
          termRef.current?.write(data);
        },
        clear() {
          termRef.current?.clear();
        },
        focus() {
          termRef.current?.focus();
        },
        fit() {
          const term = termRef.current;
          const fitAddon = fitAddonRef.current;
          if (!term || !fitAddon) return;
          fitAddon.fit();
          onResizeRef.current?.({ cols: term.cols, rows: term.rows });
        },
      }),
      [],
    );

    return (
      <div className={cn("overflow-hidden rounded-md border border-hairline bg-surface", className)}>
        <div className="flex items-center justify-between gap-3 border-b border-hairline bg-surface-2 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn("size-2 shrink-0 rounded-[3px]", STATUS_DOT[status])}
              aria-hidden="true"
            />
            <span className="truncate font-mono text-sm text-text">{title}</span>
            {subtitle && (
              <span className="truncate font-mono text-xs text-text-dim">{subtitle}</span>
            )}
          </div>
          <span className="shrink-0 text-xs text-text-dim">{STATUS_LABEL[status]}</span>
        </div>
        <div ref={containerRef} className="h-[420px] p-2" style={{ background: XTERM_THEME.background }} />
      </div>
    );
  },
);
TerminalFrame.displayName = "TerminalFrame";

export { TerminalFrame };
