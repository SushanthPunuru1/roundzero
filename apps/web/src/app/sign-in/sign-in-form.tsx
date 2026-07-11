"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Input } from "@roundzero/ui";

import { authClient } from "@/lib/auth-client";

type Status = "idle" | "google" | "magic-link" | "sent";

export function SignInForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = status === "google" || status === "magic-link";

  async function handleGoogle() {
    setError(null);
    setStatus("google");
    const { error: signInError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/app",
    });
    if (signInError) {
      setError(signInError.message ?? "Couldn't reach Google. Try again.");
      setStatus("idle");
    }
  }

  async function handleMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("magic-link");
    const { error: signInError } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/app",
    });
    if (signInError) {
      setError(
        signInError.message ??
          "Couldn't send the link. Check the address and try again.",
      );
      setStatus("idle");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rounded-md border border-hairline bg-surface-2 p-4">
        <p className="text-sm text-text">Check your email</p>
        <p className="mt-1 text-sm text-text-dim">
          We sent a sign-in link to{" "}
          <span className="font-mono text-text">{email}</span>. It expires
          shortly and can only be used once.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        onClick={handleGoogle}
        disabled={busy}
        className="w-full"
      >
        {status === "google" ? "Redirecting…" : "Continue with Google"}
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-hairline" />
        <span className="text-xs text-text-dim">or</span>
        <div className="h-px flex-1 bg-hairline" />
      </div>

      <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm text-text-dim">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@school.edu"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
        />
        <Button
          type="submit"
          variant="ghost"
          disabled={busy || !email}
          className="w-full"
        >
          {status === "magic-link" ? "Sending…" : "Send magic link"}
        </Button>
      </form>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-hairline bg-surface-2 p-3">
          <AlertCircle
            className="mt-0.5 size-4 shrink-0 text-text-dim"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="text-sm text-text">{error}</p>
        </div>
      )}
    </div>
  );
}
