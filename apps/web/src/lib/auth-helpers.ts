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
