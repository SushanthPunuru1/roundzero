// Mints the short-lived tokens the lab broker verifies. Server-only —
// `node:crypto` and the shared secret must never reach a client bundle, so
// nothing under a "use client" boundary may import this.
//
// This is the other half of lab-broker/src/token.ts. Signing and verifying
// are genuinely different operations, so two implementations is not the
// duplicated-authorization-rule mistake of DECISIONS 043 — but the FORMAT
// can drift, and lab-broker sits outside the pnpm workspace by DECISIONS
// 027's design so there is no package to share. The frozen TEST_VECTOR below
// is copied verbatim from the broker and asserted by both test suites: if
// either implementation changes shape, both fail. See DECISIONS 046.

import { createHmac } from "node:crypto";

const VERSION = "v1";

export interface LabTokenClaims {
  userId: string;
  /** null = a create-only token. `POST /labs` has no lab id yet, and a
   * token valid for every lab would be a skeleton key. */
  labId: string | null;
  expiresAt: number;
}

/** HTTP actions are server-to-server and immediate — a minute is generous.
 * Keeping it short matters because the WS variant rides in a query string,
 * which lands in access logs. */
export const HTTP_TOKEN_TTL_SECONDS = 60;

/** The terminal URL is handed to the browser, which connects a moment later.
 * Long enough for a slow page load, short enough that a logged URL is
 * useless by the time anyone reads the log. A reconnect after this expires
 * needs a freshly minted URL, not a longer TTL. */
export const WS_TOKEN_TTL_SECONDS = 300;

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** The shared secret, or null when unset. Null is legitimate only against a
 * loopback broker running in its unauthenticated dev mode — the broker
 * refuses to start in any other configuration without one (DECISIONS 047),
 * so a missing secret here can only ever fail closed. */
export function labTokenSecret(): string | null {
  const secret = process.env.RZ_TOKEN_SECRET?.trim();
  return secret ? secret : null;
}

export function mintLabToken(claims: LabTokenClaims, secret: string): string {
  const payload = JSON.stringify({ u: claims.userId, l: claims.labId, e: claims.expiresAt });
  const payloadPart = Buffer.from(payload).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${VERSION}.${payloadPart}`)
    .digest("base64url");
  return `${VERSION}.${payloadPart}.${signature}`;
}

/**
 * The `Authorization` header for a broker call, or an empty object when no
 * secret is configured. Empty is correct rather than an error: against a
 * loopback dev broker there is nothing to authenticate to, and against a
 * real one the request fails closed with the broker logging `missing`.
 */
export function labAuthHeader(
  userId: string,
  labId: string | null,
  ttlSeconds = HTTP_TOKEN_TTL_SECONDS,
): Record<string, string> {
  const secret = labTokenSecret();
  if (!secret) return {};
  const token = mintLabToken({ userId, labId, expiresAt: nowSeconds() + ttlSeconds }, secret);
  return { Authorization: `Bearer ${token}` };
}

/**
 * Frozen cross-implementation vector — byte-identical to the one in
 * lab-broker/src/token.ts. Asserted by both suites so the two
 * implementations cannot drift apart silently.
 */
export const TEST_VECTOR = {
  secret: "roundzero-test-secret-not-a-real-one",
  claims: { userId: "user_abc123", labId: "lab_def456", expiresAt: 1800000000 },
  token:
    "v1.eyJ1IjoidXNlcl9hYmMxMjMiLCJsIjoibGFiX2RlZjQ1NiIsImUiOjE4MDAwMDAwMDB9.LC6ixAWeUN5DDYtfuwxlknRNRJNGPPr271FgKhF_BtA",
} as const;
