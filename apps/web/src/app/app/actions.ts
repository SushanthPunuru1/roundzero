"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@roundzero/db";

import { auth } from "@/lib/auth";
import {
  canJoinTeam,
  isValidJoinCodeFormat,
  normalizeJoinCode,
  slugifyTeamName,
} from "@/lib/teams";

export interface TeamActionState {
  error?: string;
}

const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Team name must be at least 2 characters.")
    .max(60, "Team name must be 60 characters or fewer."),
  division: z.enum(["OPEN", "ALL_SERVICE", "MIDDLE_SCHOOL"], {
    message: "Choose a division.",
  }),
});

export async function createTeam(
  _prevState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const parsed = createTeamSchema.safeParse({
    name: formData.get("name"),
    division: formData.get("division"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const currentMembershipCount = await prisma.member.count({
    where: { userId: session.user.id },
  });
  const check = canJoinTeam({ currentMembershipCount });
  if (!check.ok) {
    return { error: check.reason };
  }

  const suffix = crypto.randomUUID().slice(0, 6);
  const slug = slugifyTeamName(parsed.data.name, suffix);

  await prisma.organization.create({
    data: {
      name: parsed.data.name,
      slug,
      division: parsed.data.division,
      members: {
        create: { userId: session.user.id, role: "coach" },
      },
    },
  });

  redirect("/app/team");
}

const joinTeamSchema = z.object({
  code: z.string().trim().min(1, "Enter a join code."),
});

export async function joinTeam(
  _prevState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const parsed = joinTeamSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a join code." };
  }

  const code = normalizeJoinCode(parsed.data.code);
  if (!isValidJoinCodeFormat(code)) {
    return { error: "That join code doesn't look right. Check it and try again." };
  }

  const currentMembershipCount = await prisma.member.count({
    where: { userId: session.user.id },
  });
  const check = canJoinTeam({ currentMembershipCount });
  if (!check.ok) {
    return { error: check.reason };
  }

  const organization = await prisma.organization.findUnique({
    where: { joinCode: code },
  });
  if (!organization) {
    return { error: "That join code doesn't match a team. Check it and try again." };
  }

  await prisma.member.create({
    data: { organizationId: organization.id, userId: session.user.id, role: "member" },
  });

  redirect("/app/team");
}
