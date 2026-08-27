import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { TEST_VECTOR, mintLabToken, verifyLabToken, type LabTokenClaims } from "./token";

const SECRET = "secret-one";
const OTHER_SECRET = "secret-two";
const NOW = 1_700_000_000;

const claims = (over: Partial<LabTokenClaims> = {}): LabTokenClaims => ({
  userId: "user_1",
  labId: "lab_1",
  expiresAt: NOW + 300,
  ...over,
});

describe("round trip", () => {
  it("verifies a token it just minted and returns the claims intact", () => {
    const result = verifyLabToken(mintLabToken(claims(), SECRET), SECRET, NOW, "lab_1");
    expect(result).toEqual({ ok: true, claims: claims() });
  });

  it("carries a create-only token (null labId) when no lab exists yet", () => {
    const token = mintLabToken(claims({ labId: null }), SECRET);
    const result = verifyLabToken(token, SECRET, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.claims.labId).toBeNull();
  });
});

describe("rejection", () => {
  it("rejects a token signed with a different secret", () => {
    const token = mintLabToken(claims(), OTHER_SECRET);
    expect(verifyLabToken(token, SECRET, NOW, "lab_1")).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  // The attack this exists to stop: edit the payload to name a different
  // user, keep the old signature, and hope nobody re-derives the HMAC.
  it("rejects a payload edited after signing", () => {
    const token = mintLabToken(claims(), SECRET);
    const [v, , sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "attacker", l: "lab_1", e: NOW + 300 })).toString(
      "base64url",
    );
    expect(verifyLabToken(`${v}.${forged}.${sig}`, SECRET, NOW, "lab_1")).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("rejects an expired token, and treats the exact expiry second as expired", () => {
    const token = mintLabToken(claims({ expiresAt: NOW }), SECRET);
    expect(verifyLabToken(token, SECRET, NOW, "lab_1")).toEqual({ ok: false, reason: "expired" });
  });

  // A token is scoped to one lab on purpose: leaking it must not hand over
  // every lab on the box.
  it("rejects a valid token presented for a different lab", () => {
    const token = mintLabToken(claims({ labId: "lab_1" }), SECRET);
    expect(verifyLabToken(token, SECRET, NOW, "lab_2")).toEqual({ ok: false, reason: "wrong-lab" });
  });

  it("rejects a create-only token used to open an existing lab", () => {
    const token = mintLabToken(claims({ labId: null }), SECRET);
    expect(verifyLabToken(token, SECRET, NOW, "lab_1")).toEqual({ ok: false, reason: "wrong-lab" });
  });

  it("rejects an unknown version prefix rather than trying to parse it", () => {
    const token = mintLabToken(claims(), SECRET).replace(/^v1\./, "v2.");
    expect(verifyLabToken(token, SECRET, NOW, "lab_1")).toEqual({ ok: false, reason: "bad-version" });
  });

  it.each([
    ["empty", ""],
    ["no dots", "garbage"],
    ["two parts", "v1.abc"],
    ["four parts", "v1.a.b.c"],
  ])("rejects a malformed token (%s) without throwing", (_label, token) => {
    expect(() => verifyLabToken(token, SECRET, NOW)).not.toThrow();
    expect(verifyLabToken(token, SECRET, NOW).ok).toBe(false);
  });

  // Signature is checked before the payload is parsed, so unauthenticated
  // JSON never reaches JSON.parse as a live attack surface. A correctly
  // signed but structurally wrong payload is the only way to reach that
  // path, and it must still not throw.
  // Signed by us, so it passes the signature gate and reaches the payload
  // parser — the only way to exercise that path at all.
  function signedRaw(payloadObject: unknown, secret = SECRET): string {
    const part = Buffer.from(JSON.stringify(payloadObject)).toString("base64url");
    const sig = createHmac("sha256", secret).update(`v1.${part}`).digest("base64url");
    return `v1.${part}.${sig}`;
  }

  it.each([
    ["userId not a string", { u: 123, l: "lab_1", e: NOW + 60 }],
    ["expiry not a number", { u: "user_1", l: "lab_1", e: "soon" }],
    ["labId neither string nor null", { u: "user_1", l: 7, e: NOW + 60 }],
    ["missing fields entirely", { nope: true }],
    ["payload is an array", ["u", "l", "e"]],
    ["payload is null", null],
  ])("rejects a correctly signed payload with the wrong shape (%s)", (_label, payload) => {
    const token = signedRaw(payload);
    expect(() => verifyLabToken(token, SECRET, NOW)).not.toThrow();
    expect(verifyLabToken(token, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects a correctly signed payload that isn't JSON at all", () => {
    const part = Buffer.from("not json {{{").toString("base64url");
    const sig = createHmac("sha256", SECRET).update(`v1.${part}`).digest("base64url");
    expect(verifyLabToken(`v1.${part}.${sig}`, SECRET, NOW)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});

describe("cross-implementation test vector", () => {
  // apps/web mints and the broker verifies — two implementations of one
  // format. This frozen vector is what keeps them honest; apps/web asserts
  // the identical constant. A format change fails both sides' tests instead
  // of failing silently in production.
  it("mints exactly the frozen token", () => {
    expect(mintLabToken(TEST_VECTOR.claims, TEST_VECTOR.secret)).toBe(TEST_VECTOR.token);
  });

  it("verifies the frozen token", () => {
    const result = verifyLabToken(
      TEST_VECTOR.token,
      TEST_VECTOR.secret,
      TEST_VECTOR.claims.expiresAt - 1,
      TEST_VECTOR.claims.labId,
    );
    expect(result).toEqual({ ok: true, claims: TEST_VECTOR.claims });
  });
});
