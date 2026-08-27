// Request authentication for the broker: where the token comes from, and
// whether a given deployment is allowed to run without one. Pure — the HTTP
// layer passes in what it read. See docs/PHASE2_INFRA_SPEC.md §2.3.

import { verifyLabToken, type LabTokenClaims, type VerifyFailure } from "./token";

export class InsecureConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsecureConfigError";
  }
}

export type AuthMode =
  | { required: true; secret: string }
  | { required: false; reason: "loopback-dev" };

/** Hosts where an unauthenticated broker is defensible: nothing outside the
 * machine can reach it. Anything else is a public bind. */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

/**
 * Decides whether this process may run without token auth.
 *
 * The rule: **binding anywhere but loopback requires a secret, and the
 * process refuses to start without one.** A silent "auth disabled" fallback
 * is precisely how a service ends up publicly exposed with no
 * authentication — the failure is invisible until someone finds the port.
 * Making the dangerous configuration impossible beats documenting it.
 *
 * Loopback with no secret stays allowed because that is the local
 * single-user development case DECISIONS 027 describes, where the bind
 * itself is the boundary.
 */
export function resolveAuthMode(host: string, secret: string | undefined): AuthMode {
  const trimmed = secret?.trim();
  if (trimmed) return { required: true, secret: trimmed };

  if (LOOPBACK_HOSTS.has(host)) return { required: false, reason: "loopback-dev" };

  throw new InsecureConfigError(
    `Refusing to start: HOST is "${host}" (not loopback) and RZ_TOKEN_SECRET is unset. ` +
      `A non-loopback bind with no token secret would expose an unauthenticated root shell. ` +
      `Set RZ_TOKEN_SECRET, or bind 127.0.0.1 for local development.`,
  );
}

/**
 * Pulls the token out of a request.
 *
 * Two sources because the two transports differ: HTTP routes use
 * `Authorization: Bearer`, but the browser WebSocket API cannot set headers,
 * so the terminal upgrade has to carry it in the query string. Query strings
 * land in access logs and proxy logs, which is exactly why these tokens are
 * minted short-lived — a leaked one expires on its own.
 */
export function extractToken(headerValue: string | undefined, queryToken: string | null): string | null {
  if (headerValue) {
    const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
    if (match) return match[1]!.trim();
  }
  return queryToken && queryToken.length > 0 ? queryToken : null;
}

export type AuthResult =
  | { ok: true; claims: LabTokenClaims | null }
  | { ok: false; reason: VerifyFailure | "missing" };

/**
 * Authenticates one request. `claims` is null when auth is disabled
 * (loopback dev) — callers treat that as "no owner scoping", which is
 * correct for a single-user local broker and impossible in any other
 * configuration because resolveAuthMode would have refused to start.
 *
 * The failure `reason` is for the broker's own logs. It must never be sent
 * to the client: "expired" and "wrong-lab" both confirm a valid signature.
 */
export function authenticate(
  mode: AuthMode,
  token: string | null,
  nowSeconds: number,
  requiredLabId?: string,
): AuthResult {
  if (!mode.required) return { ok: true, claims: null };
  if (!token) return { ok: false, reason: "missing" };

  const result = verifyLabToken(token, mode.secret, nowSeconds, requiredLabId);
  return result.ok ? { ok: true, claims: result.claims } : { ok: false, reason: result.reason };
}
