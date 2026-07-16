"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CommandBlock({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-surface-2">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-3 py-1.5">
        <span className="text-[11px] uppercase tracking-[0.06em] text-text-dim">{label}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied to clipboard" : "Copy command"}
          className="flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[11px] text-text-dim transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {copied ? (
            <>
              <Check className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-[20px] text-text">
        <code>{command}</code>
      </pre>
    </div>
  );
}
