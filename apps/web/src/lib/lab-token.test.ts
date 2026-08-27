import { afterEach, describe, expect, it } from "vitest";

import { TEST_VECTOR, labAuthHeader, labTokenSecret, mintLabToken } from "./lab-token";

const ORIGINAL = process.env.RZ_TOKEN_SECRET;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.RZ_TOKEN_SECRET;
  else process.env.RZ_TOKEN_SECRET = ORIGINAL;
});

describe("cross-implementation test vector", () => {
  // The load-bearing test in this file. lab-broker/src/token.test.ts asserts
  // the identical constant against its own verifier, so a format change on
  // either side fails both suites rather than failing in production with
  // every request rejected and no obvious cause.
  it("mints byte-identically to the broker's frozen vector", () => {
    expect(mintLabToken(TEST_VECTOR.claims, TEST_VECTOR.secret)).toBe(TEST_VECTOR.token);
  });

  it("keeps the vector itself in the shape the broker expects", () => {
    const [version, payload, signature] = TEST_VECTOR.token.split(".");
    expect(version).toBe("v1");
    expect(JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"))).toEqual({
      u: TEST_VECTOR.claims.userId,
      l: TEST_VECTOR.claims.labId,
      e: TEST_VECTOR.claims.expiresAt,
    });
    expect(signature).toBeTruthy();
  });
});

describe("mintLabToken", () => {
  it("produces a different token for a different user, lab, or expiry", () => {
    const base = { userId: "u1", labId: "lab_1", expiresAt: 1000 };
    const token = mintLabToken(base, "s");
    expect(mintLabToken({ ...base, userId: "u2" }, "s")).not.toBe(token);
    expect(mintLabToken({ ...base, labId: "lab_2" }, "s")).not.toBe(token);
    expect(mintLabToken({ ...base, expiresAt: 1001 }, "s")).not.toBe(token);
    expect(mintLabToken(base, "other-secret")).not.toBe(token);
  });

  it("encodes a create-only token with a null lab", () => {
    const token = mintLabToken({ userId: "u1", labId: null, expiresAt: 1000 }, "s");
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"));
    expect(payload.l).toBeNull();
  });
});

describe("labTokenSecret", () => {
  it("treats blank and whitespace as unset, matching the broker", () => {
    process.env.RZ_TOKEN_SECRET = "";
    expect(labTokenSecret()).toBeNull();
    process.env.RZ_TOKEN_SECRET = "   ";
    expect(labTokenSecret()).toBeNull();
    process.env.RZ_TOKEN_SECRET = "  padded  ";
    expect(labTokenSecret()).toBe("padded");
  });
});

describe("labAuthHeader", () => {
  it("returns a bearer header when a secret is configured", () => {
    process.env.RZ_TOKEN_SECRET = "s";
    const header = labAuthHeader("u1", "lab_1");
    expect(header.Authorization).toMatch(/^Bearer v1\./);
  });

  // Empty rather than throwing: against a loopback dev broker there is
  // nothing to authenticate to, and against a real one the request simply
  // fails closed with the broker logging "missing".
  it("returns no header at all when no secret is configured", () => {
    delete process.env.RZ_TOKEN_SECRET;
    expect(labAuthHeader("u1", "lab_1")).toEqual({});
  });
});
