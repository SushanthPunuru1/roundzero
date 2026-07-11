"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, cn, type ButtonProps } from "@roundzero/ui";

import { authClient } from "@/lib/auth-client";

export function SignOutButton({
  className,
  size,
}: {
  className?: string;
  size?: ButtonProps["size"];
}) {
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
      size={size}
      onClick={handleSignOut}
      disabled={loading}
      className={cn("w-full", className)}
    >
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
