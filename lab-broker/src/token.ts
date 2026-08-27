// Lab access tokens — the thing that replaces "we only bind loopback" as the
// broker's security model. Pure: no I/O, no clock of its own, no env reads.
// See docs/PHASE2_INFRA_SPEC.md §2.3.
//
// The shape of the problem. `apps/web` knows who the user is (Better Auth
// session) and runs on Vercel; the broker knows nothing about users and runs
// on a box. The browser also connects to the broker's WebSocket *directly*,
// because serverless is a poor WS proxy — so the credential has to travel in
// a URL/header the browser can send, and be verifiable by the broker with no
// callback to the app and no shared database.
//
// A short-lived HMAC token does exactly that. apps/web mints, the broker
// verifies, and the only shared state is a secret in both environments.
//
// Minting lives in apps/web and verification lives here, which means two
// implementations of one format. That is not the duplicated-authorization-rule
// mistake of DECISIONS 043 — signing and checking are genuinely different
// operations — but the FORMAT can still drift, so both sides assert the same
// frozen test vector (TEST_VECTOR below). If either implementation changes,
// its own test fails.

import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = "v1";

export interface LabTokenClaims {
  /** Better Auth user id. The lab's owner. */
  userId: string;
  /** The lab this token is good for, or null for a token that may only
   * CREATE a lab — at mint time for `POST /labs` no lab id exists yet, and
   * issuing a wildcard-for-all-labs token instead would be a skeleton key. */
  labId: string | null;
  /** Absolute expiry, epoch seconds. */
  expiresAt: number;
}

export type VerifyFailure =
  | "malformed"
  | "bad-version"
  | "bad-signature"
  | "expired"
  | "wrong-lab";

export type VerifyResult =
  | { ok: true; claims: LabTokenClaims }
  | { ok: false; reason: VerifyFailure };

/** Wire payload. Short keys because this rides in a URL on every terminal
 * reconnect; the format is frozen by TEST_VECTOR, so renaming these is a
 * breaking change that both sides' tests will catch. */
interface WirePayload {
  u: string;
  l: string | null;
  e: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadPart: string, secret: string): string {
  return createHmac("sha256", secret).update(`${VERSION}.${payloadPart}`).digest("base64url");
}

/**
 * Mints a token. Exported from the broker as well as implemented in apps/web
 * so the round trip can be tested here without importing across the
 * workspace boundary — lab-broker is deliberately outside the pnpm workspace
 * (DECISIONS 027).
 */
export function mintLabToken(claims: LabTokenClaims, secret: string): string {
  const payload: WirePayload = { u: claims.userId, l: claims.labId, e: claims.expiresAt };
  const payloadPart = b64url(JSON.stringify(payload));
  return `${VERSION}.${payloadPart}.${sign(payloadPart, secret)}`;
}

/**
 * Verifies a token and, when `requiredLabId` is given, that it was issued for
 * that specific lab.
 *
 * Returns a reason rather than throwing, and rather than collapsing to a
 * boolean, so the broker can log *why* a request was refused while still
 * telling the client nothing beyond "no". Never let the reason reach the
 * client: "expired" and "wrong-lab" both confirm a valid signature, which
 * tells an attacker their secret guess was right.
 */
export function verifyLabToken(
  token: string,
  secret: string,
  nowSeconds: number,
  requiredLabId?: string,
): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [version, payloadPart, signaturePart] = parts as [string, string, string];
  if (version !== VERSION) return { ok: false, reason: "bad-version" };

  // Signature FIRST, before parsing the payload. Parsing attacker-controlled
  // JSON that has not been authenticated is how you turn a signature check
  // into a JSON-parser attack surface.
  const expected = Buffer.from(sign(payloadPart, secret));
  const actual = Buffer.from(signaturePart);
  // timingSafeEqual throws on length mismatch, so the length check has to
  // happen first — and it leaks only the length, which is fixed for SHA-256.
  if (expected.length !== actual.length) return { ok: false, reason: "bad-signature" };
  if (!timingSafeEqual(expected, actual)) return { ok: false, reason: "bad-signature" };

  let payload: WirePayload;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof (decoded as WirePayload).u !== "string" ||
      typeof (decoded as WirePayload).e !== "number" ||
      !(typeof (decoded as WirePayload).l === "string" || (decoded as WirePayload).l === null)
    ) {
      return { ok: false, reason: "malformed" };
    }
    payload = decoded as WirePayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (payload.e <= nowSeconds) return { ok: false, reason: "expired" };

  // A token minted for lab A must not open lab B, and a create-only token
  // (labId null) must not open any existing lab.
  if (requiredLabId !== undefined && payload.l !== requiredLabId) {
    return { ok: false, reason: "wrong-lab" };
  }

  return { ok: true, claims: { userId: payload.u, labId: payload.l, expiresAt: payload.e } };
}

/**
 * Frozen cross-implementation test vector. apps/web's minting asserts this
 * exact string; so does token.test.ts here. If the two implementations ever
 * disagree about the format, both tests fail rather than production failing
 * silently at 2am.
 *
 * The secret is a literal fixture and is not a real secret.
 */
export const TEST_VECTOR = {
  secret: "roundzero-test-secret-not-a-real-one",
  claims: { userId: "user_abc123", labId: "lab_def456", expiresAt: 1800000000 },
  token:
    "v1.eyJ1IjoidXNlcl9hYmMxMjMiLCJsIjoibGFiX2RlZjQ1NiIsImUiOjE4MDAwMDAwMDB9.LC6ixAWeUN5DDYtfuwxlknRNRJNGPPr271FgKhF_BtA",
} as const;
