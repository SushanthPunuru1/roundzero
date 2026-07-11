import { describe, expect, it } from "vitest";
import {
  buildMagicLinkConfirmUrl,
  buildMagicLinkEmail,
  viewerFromSession,
} from "./auth-helpers";

describe("buildMagicLinkEmail", () => {
  it("includes the sign-in url and a sentence-case subject", () => {
    const { subject, text } = buildMagicLinkEmail({
      url: "https://roundzero.example/api/auth/magic-link/verify?token=abc",
    });
    expect(subject).toBe("Sign in to RoundZero");
    expect(text).toContain(
      "https://roundzero.example/api/auth/magic-link/verify?token=abc",
    );
  });

  it("honors a custom app name", () => {
    const { subject } = buildMagicLinkEmail({
      url: "https://example.com",
      appName: "Test App",
    });
    expect(subject).toBe("Sign in to Test App");
  });
});

describe("buildMagicLinkConfirmUrl", () => {
  it("points at the app's /magic-link page, not the raw API endpoint", () => {
    const confirmUrl = buildMagicLinkConfirmUrl({
      token: "abc123",
      originalUrl:
        "https://roundzero.example/api/auth/magic-link/verify?token=abc123&callbackURL=%2Fapp",
    });
    const parsed = new URL(confirmUrl);
    expect(parsed.pathname).toBe("/magic-link");
    expect(parsed.searchParams.get("token")).toBe("abc123");
    expect(parsed.searchParams.get("callbackURL")).toBe("/app");
  });

  it("preserves the origin from the original url", () => {
    const confirmUrl = buildMagicLinkConfirmUrl({
      token: "tok",
      originalUrl: "https://roundzero.example/api/auth/magic-link/verify?token=tok",
    });
    expect(new URL(confirmUrl).origin).toBe("https://roundzero.example");
  });

  it("defaults callbackURL to /app when the original url omits it", () => {
    const confirmUrl = buildMagicLinkConfirmUrl({
      token: "tok",
      originalUrl: "https://roundzero.example/api/auth/magic-link/verify?token=tok",
    });
    expect(new URL(confirmUrl).searchParams.get("callbackURL")).toBe("/app");
  });
});

describe("viewerFromSession", () => {
  it("maps session user fields to a viewer", () => {
    const viewer = viewerFromSession({
      user: { name: "Ada Lovelace", email: "ada@example.com", platformRole: "COACH" },
    });
    expect(viewer).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      platformRole: "COACH",
    });
  });

  it("defaults platformRole to STUDENT when absent", () => {
    const viewer = viewerFromSession({
      user: { name: "Grace Hopper", email: "grace@example.com" },
    });
    expect(viewer.platformRole).toBe("STUDENT");
  });

  it("falls back to email when name is blank (magic-link sign-up)", () => {
    const viewer = viewerFromSession({
      user: { name: "", email: "student@example.com" },
    });
    expect(viewer.name).toBe("student@example.com");
  });
});
