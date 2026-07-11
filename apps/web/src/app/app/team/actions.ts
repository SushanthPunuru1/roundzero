"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@roundzero/db";

import { auth } from "@/lib/auth";
import { canManageRoster, canPromoteToCaptain, canRemoveMember } from "@/lib/teams";

export interface RosterActionState {
  error?: string;
}

async function requireActingMember() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const member = await prisma.member.findFirst({ where: { userId: session.user.id } });
  if (!member) redirect("/app");

  return member;
}

async function requireTargetInSameOrg(memberId: string, organizationId: string) {
  const target = await prisma.member.findUnique({ where: { id: memberId } });
  if (!target || target.organizationId !== organizationId) return null;
  return target;
}

const NOT_ON_TEAM_ERROR = "That member isn't on your team.";
const COACH_ONLY_ERROR = "Only the coach can manage the roster.";

const machineRoleSchema = z.object({
  memberId: z.string().min(1),
  machineRole: z.enum(["WINDOWS", "LINUX", "CISCO", "NONE"]),
});

export async function setMachineRole(
  _prevState: RosterActionState,
  formData: FormData,
): Promise<RosterActionState> {
  const actor = await requireActingMember();
  if (!canManageRoster(actor.role)) {
    return { error: COACH_ONLY_ERROR };
  }

  const parsed = machineRoleSchema.safeParse({
    memberId: formData.get("memberId"),
    machineRole: formData.get("machineRole"),
  });
  if (!parsed.success) {
    return { error: "Choose a valid machine role." };
  }

  const target = await requireTargetInSameOrg(parsed.data.memberId, actor.organizationId);
  if (!target) {
    return { error: NOT_ON_TEAM_ERROR };
  }

  await prisma.member.update({
    where: { id: target.id },
    data: {
      machineRole: parsed.data.machineRole === "NONE" ? null : parsed.data.machineRole,
    },
  });

  revalidatePath("/app/team");
  return {};
}

const memberIdSchema = z.object({ memberId: z.string().min(1) });

export async function promoteToCaptain(
  _prevState: RosterActionState,
  formData: FormData,
): Promise<RosterActionState> {
  const actor = await requireActingMember();
  if (!canManageRoster(actor.role)) {
    return { error: COACH_ONLY_ERROR };
  }

  const parsed = memberIdSchema.safeParse({ memberId: formData.get("memberId") });
  if (!parsed.success) {
    return { error: NOT_ON_TEAM_ERROR };
  }

  const target = await requireTargetInSameOrg(parsed.data.memberId, actor.organizationId);
  if (!target) {
    return { error: NOT_ON_TEAM_ERROR };
  }
  if (!canPromoteToCaptain(target.role)) {
    return { error: "Only members can be promoted to captain." };
  }

  await prisma.member.update({ where: { id: target.id }, data: { role: "captain" } });
  revalidatePath("/app/team");
  return {};
}

export async function removeMember(
  _prevState: RosterActionState,
  formData: FormData,
): Promise<RosterActionState> {
  const actor = await requireActingMember();
  if (!canManageRoster(actor.role)) {
    return { error: COACH_ONLY_ERROR };
  }

  const parsed = memberIdSchema.safeParse({ memberId: formData.get("memberId") });
  if (!parsed.success) {
    return { error: NOT_ON_TEAM_ERROR };
  }

  const target = await requireTargetInSameOrg(parsed.data.memberId, actor.organizationId);
  if (!target) {
    return { error: NOT_ON_TEAM_ERROR };
  }
  if (!canRemoveMember(target.role)) {
    return { error: "You can't remove the coach." };
  }

  await prisma.member.delete({ where: { id: target.id } });
  revalidatePath("/app/team");
  return {};
}
