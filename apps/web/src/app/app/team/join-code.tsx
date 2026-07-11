"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@roundzero/ui";

export function JoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface-2 pl-3 pr-1.5">
      <span className="font-mono text-sm text-text">{code}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        aria-label={copied ? "Join code copied" : "Copy join code"}
      >
        {copied ? (
          <Check className="size-4 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Copy className="size-4 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
