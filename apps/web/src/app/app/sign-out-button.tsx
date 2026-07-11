"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@roundzero/ui";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleSignOut}
      disabled={loading}
      className="w-full"
    >
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
