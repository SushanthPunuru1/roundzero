import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink, organization } from "better-auth/plugins";
import { Resend } from "resend";
import { prisma } from "@roundzero/db";

import { buildMagicLinkEmail } from "./auth-helpers";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  // APP FIELDS on User (packages/db/prisma/schema.prisma) — system/coach
  // assigned, never settable through the auth API at sign-up.
  user: {
    additionalFields: {
      platformRole: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "STUDENT",
      },
      displayHandle: {
        type: "string",
        required: false,
        input: false,
      },
      gradeBand: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const { subject, text } = buildMagicLinkEmail({ url });
        await resend.emails.send({
          from: "RoundZero <onboarding@resend.dev>",
          to: email,
          subject,
          text,
        });
      },
    }),
    // One Organization == one team (DECISIONS 004). Team create/join UI is
    // next session — this only makes the plugin + schema ready.
    organization({
      // APP FIELDS on Organization/Member — join-code, division, season,
      // machine role are all app-owned, not auth-owned.
      schema: {
        organization: {
          additionalFields: {
            division: { type: "string", required: false, input: false },
            joinCode: { type: "string", required: false, input: false },
            seasonId: { type: "string", required: false, input: false },
          },
        },
        member: {
          additionalFields: {
            machineRole: { type: "string", required: false, input: false },
          },
        },
      },
    }),
    // Must be last: sets auth cookies from Server Actions/Route Handlers.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
