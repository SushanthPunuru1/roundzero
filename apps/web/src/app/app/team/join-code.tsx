"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, cn } from "@roundzero/ui";

export function JoinCode({
  code,
  variant = "inline",
}: {
  code: string;
  variant?: "inline" | "panel";
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (variant === "panel") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-hairline bg-surface-2 px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.06em] text-text-dim">
            Join code
          </p>
          <p className="mt-1 font-mono text-lg text-text">{code}</p>
        </div>
        <Button type="button" onClick={handleCopy} className="w-auto">
          {copied ? (
            <>
              <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Copy code
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-hairline bg-surface-2 py-1 pl-3 pr-1.5">
      <span className="text-[11px] uppercase tracking-[0.06em] text-text-dim">
        Join code
      </span>
      <span className="font-mono text-sm text-text">{code}</span>
      <div className="relative flex items-center">
        <span
          className={cn(
            "pointer-events-none absolute top-full right-0 z-10 mt-2 whitespace-nowrap rounded-sm border border-hairline bg-surface-2 px-1.5 py-0.5 text-xs text-text-dim transition-opacity duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
            copied ? "opacity-100" : "opacity-0",
          )}
          aria-hidden={!copied}
        >
          Copied
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          aria-label={copied ? "Join code copied" : "Copy join code"}
        >
          {copied ? (
            <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Copy
              className="size-4 text-text-dim"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          )}
        </Button>
      </div>
    </div>
  );
}
