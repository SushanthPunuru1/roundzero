import { describe, expect, it } from "vitest";
import { buildMagicLinkEmail, viewerFromSession } from "./auth-helpers";

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
