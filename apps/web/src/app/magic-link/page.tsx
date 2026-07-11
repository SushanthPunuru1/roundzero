import { Suspense } from "react";

import { MagicLinkConfirm } from "./magic-link-confirm";

export default function MagicLinkPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-md border border-hairline bg-surface p-8">
        <p className="text-[11px] uppercase tracking-[0.06em] text-text-dim">
          RoundZero
        </p>
        <h1 className="mt-2 text-xl font-semibold text-text">Signing you in</h1>
        <div className="mt-6">
          <Suspense
            fallback={<p className="text-sm text-text-dim">Confirming your link…</p>}
          >
            <MagicLinkConfirm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
