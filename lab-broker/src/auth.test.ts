import { describe, expect, it } from "vitest";

import { InsecureConfigError, authenticate, extractToken, resolveAuthMode } from "./auth";
import { mintLabToken } from "./token";

const SECRET = "a-secret";
const NOW = 1_700_000_000;

describe("resolveAuthMode", () => {
  it("requires auth whenever a secret is configured, loopback or not", () => {
    expect(resolveAuthMode("127.0.0.1", SECRET)).toEqual({ required: true, secret: SECRET });
    expect(resolveAuthMode("0.0.0.0", SECRET)).toEqual({ required: true, secret: SECRET });
  });

  it("allows an unauthenticated loopback broker — the local dev case", () => {
    for (const host of ["127.0.0.1", "::1", "localhost"]) {
      expect(resolveAuthMode(host, undefined)).toEqual({ required: false, reason: "loopback-dev" });
    }
  });

  // The property this module exists for. A silent "auth disabled" fallback
  // on a public bind is how a service ends up exposed with no auth and
  // nobody noticing until someone finds the port.
  it("REFUSES to start on a non-loopback bind with no secret", () => {
    for (const host of ["0.0.0.0", "10.0.0.5", "::", "example.com"]) {
      expect(() => resolveAuthMode(host, undefined)).toThrow(InsecureConfigError);
    }
  });

  it("treats a blank or whitespace secret as absent, not as a secret", () => {
    expect(() => resolveAuthMode("0.0.0.0", "")).toThrow(InsecureConfigError);
    expect(() => resolveAuthMode("0.0.0.0", "   ")).toThrow(InsecureConfigError);
  });

  it("trims a secret rather than silently keying on whitespace", () => {
    expect(resolveAuthMode("0.0.0.0", "  padded  ")).toEqual({ required: true, secret: "padded" });
  });
});

describe("extractToken", () => {
  it("reads a bearer header, case-insensitively", () => {
    expect(extractToken("Bearer abc.def.ghi", null)).toBe("abc.def.ghi");
    expect(extractToken("bearer abc", null)).toBe("abc");
    expect(extractToken("BEARER   abc  ", null)).toBe("abc");
  });

  // The browser WebSocket API cannot set headers, so the terminal upgrade
  // has no choice but the query string.
  it("falls back to the query parameter for the WebSocket upgrade", () => {
    expect(extractToken(undefined, "from-query")).toBe("from-query");
  });

  it("prefers the header when both are present", () => {
    expect(extractToken("Bearer from-header", "from-query")).toBe("from-header");
  });

  it("returns null when there is nothing usable", () => {
    expect(extractToken(undefined, null)).toBeNull();
    expect(extractToken(undefined, "")).toBeNull();
    expect(extractToken("Basic dXNlcjpwYXNz", null)).toBeNull();
    expect(extractToken("Bearer", null)).toBeNull();
  });
});

describe("authenticate", () => {
  const required = { required: true, secret: SECRET } as const;
  const disabled = { required: false, reason: "loopback-dev" } as const;

  it("passes a valid token through with its claims", () => {
    const token = mintLabToken({ userId: "u1", labId: "lab_1", expiresAt: NOW + 60 }, SECRET);
    const result = authenticate(required, token, NOW, "lab_1");
    expect(result).toEqual({
      ok: true,
      claims: { userId: "u1", labId: "lab_1", expiresAt: NOW + 60 },
    });
  });

  it("refuses a request with no token when auth is required", () => {
    expect(authenticate(required, null, NOW)).toEqual({ ok: false, reason: "missing" });
  });

  it("surfaces the verify failure for logging", () => {
    const token = mintLabToken({ userId: "u1", labId: "lab_1", expiresAt: NOW - 1 }, SECRET);
    expect(authenticate(required, token, NOW, "lab_1")).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses a token minted for another lab", () => {
    const token = mintLabToken({ userId: "u1", labId: "lab_1", expiresAt: NOW + 60 }, SECRET);
    expect(authenticate(required, token, NOW, "lab_2")).toEqual({ ok: false, reason: "wrong-lab" });
  });

  // Null claims mean "no owner scoping", which is only reachable on a
  // loopback bind — resolveAuthMode makes any other configuration refuse to
  // start, so this cannot be how a public broker behaves.
  it("passes with null claims when auth is disabled", () => {
    expect(authenticate(disabled, null, NOW)).toEqual({ ok: true, claims: null });
    expect(authenticate(disabled, "anything", NOW)).toEqual({ ok: true, claims: null });
  });
});
