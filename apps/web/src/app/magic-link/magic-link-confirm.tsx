"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@roundzero/ui";

type Status = "verifying" | "error";

const ERROR_COPY: Record<string, string> = {
  INVALID_TOKEN: "This link has already been used or has expired.",
};
const DEFAULT_ERROR = "This link is invalid. Request a new one.";

export function MagicLinkConfirm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const callbackURL = searchParams.get("callbackURL") || "/app";

  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const [message, setMessage] = useState(DEFAULT_ERROR);

  // The token is single-use — Strict Mode's dev double-invoke of effects
  // would otherwise consume it on the first (throwaway) pass and hand the
  // real one an already-used token.
  const hasRun = useRef(false);

  useEffect(() => {
    if (!token || hasRun.current) return;
    hasRun.current = true;

    const verifyUrl = new URL("/api/auth/magic-link/verify", window.location.origin);
    verifyUrl.searchParams.set("token", token);
    // Deliberately omit callbackURL: Better Auth returns JSON (200) instead
    // of issuing a redirect when it's absent, which is what lets us tell
    // success apart from failure without following/parsing a redirect.

    fetch(verifyUrl.toString(), { credentials: "include" })
      .then((res) => {
        if (!res.redirected && res.ok) {
          router.replace(callbackURL);
          return;
        }
        const error = new URL(res.url).searchParams.get("error");
        setMessage((error && ERROR_COPY[error]) ?? DEFAULT_ERROR);
        setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, [token, callbackURL, router]);

  if (status === "verifying") {
    return <p className="text-sm text-text-dim">Confirming your link…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border border-hairline bg-surface-2 p-3">
        <AlertCircle
          className="mt-0.5 size-4 shrink-0 text-text-dim"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <p className="text-sm text-text">{message}</p>
      </div>
      <Button
        type="button"
        onClick={() => router.push("/sign-in")}
        className="w-full"
      >
        Back to sign in
      </Button>
    </div>
  );
}
