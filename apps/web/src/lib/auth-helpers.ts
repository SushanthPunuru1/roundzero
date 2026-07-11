// Pure helpers extracted out of auth.ts so they can be unit-tested without
// touching the Prisma adapter, Google, or Resend.

export function buildMagicLinkEmail({
  url,
  appName = "RoundZero",
}: {
  url: string;
  appName?: string;
}): { subject: string; text: string } {
  return {
    subject: `Sign in to ${appName}`,
    text: `Use this link to sign in: ${url}\n\nThis link expires shortly and can only be used once. If you didn't request it, ignore this email.`,
  };
}

// Better Auth's default magic-link URL points straight at the API's GET
// verify endpoint, which consumes the (single-use) token on the first
// request to it. Email clients and corporate security gateways routinely
// prefetch/scan links in emails before the user ever clicks — that GET
// consumes the token, so the real click always sees an already-used token.
// Routing through an app page instead defers the token-consuming request to
// client-side JS, which scanners generally don't execute.
export function buildMagicLinkConfirmUrl({
  token,
  originalUrl,
}: {
  token: string;
  originalUrl: string;
}): string {
  const parsed = new URL(originalUrl);
  const callbackURL = parsed.searchParams.get("callbackURL") ?? "/app";
  const confirmUrl = new URL("/magic-link", parsed.origin);
  confirmUrl.searchParams.set("token", token);
  confirmUrl.searchParams.set("callbackURL", callbackURL);
  return confirmUrl.toString();
}

export interface ViewerSession {
  user: {
    name: string;
    email: string;
    platformRole?: string | null;
  };
}

export interface Viewer {
  name: string;
  email: string;
  platformRole: string;
}

export function viewerFromSession(session: ViewerSession): Viewer {
  return {
    // Magic-link sign-up never collects a name; fall back to email so the
    // placeholder page never renders a blank heading.
    name: session.user.name.trim() || session.user.email,
    email: session.user.email,
    platformRole: session.user.platformRole ?? "STUDENT",
  };
}
