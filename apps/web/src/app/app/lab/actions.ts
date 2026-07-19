"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@roundzero/db";
import type { ScoreLineState } from "@roundzero/ui";

import { auth } from "@/lib/auth";

const BROKER_TIMEOUT_MS = 5000;

class BrokerUnavailableError extends Error {}

function brokerBaseUrl(): string | null {
  return process.env.LAB_BROKER_URL || null;
}

/** apps/web never opens the terminal socket itself — it only returns the
 * broker's own ws:// URL, which the browser connects to directly (a
 * WebSocket can't be proxied through a Vercel serverless function, and this
 * feature is local-only by design; see docs/DECISIONS.md 027). */
function wsUrlFor(base: string, labId: string): string {
  return `${base.replace(/^http/, "ws")}/labs/${labId}/term`;
}

async function brokerFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = brokerBaseUrl();
  if (!base) {
    throw new BrokerUnavailableError(
      "The lab broker isn't configured for this deployment — this feature is local-only. See lab-broker/README.md.",
    );
  }
  try {
    return await fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(BROKER_TIMEOUT_MS) });
  } catch {
    throw new BrokerUnavailableError(
      "Couldn't reach the lab broker. Make sure it's running locally (see lab-broker/README.md).",
    );
  }
}

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}

async function brokerErrorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // fall through to a generic message
  }
  return `The lab broker returned an unexpected error (${res.status}).`;
}

export interface LaunchLabResult {
  labId?: string;
  wsUrl?: string;
  error?: string;
}

export async function launchLab(): Promise<LaunchLabResult> {
  await requireSession();
  try {
    const res = await brokerFetch("/labs", { method: "POST" });
    if (res.status !== 201) {
      return { error: await brokerErrorMessage(res) };
    }
    const body = (await res.json()) as { id: string };
    return { labId: body.id, wsUrl: wsUrlFor(brokerBaseUrl()!, body.id) };
  } catch (err) {
    return { error: err instanceof BrokerUnavailableError ? err.message : "Couldn't launch the lab." };
  }
}

export interface ScoreRow {
  id: string;
  state: ScoreLineState;
  points: number;
  possiblePoints: number;
  category: string;
  title: string;
  why: string;
  lessonHref?: string;
}

export interface ScoreLabResult {
  totalEarned?: number;
  totalPossible?: number;
  rows?: ScoreRow[];
  error?: string;
}

export async function scoreLab(labId: string): Promise<ScoreLabResult> {
  await requireSession();
  try {
    const res = await brokerFetch(`/labs/${encodeURIComponent(labId)}/score`, { method: "POST" });
    if (res.status !== 200) {
      return { error: await brokerErrorMessage(res) };
    }
    const report = (await res.json()) as {
      totalEarned: number;
      totalPossible: number;
      checks: {
        id: string;
        title: string;
        skillNode: string;
        points: number;
        earned: number;
        pass: boolean;
        detail: string;
        error?: string;
      }[];
    };

    const skillNodeIds = [...new Set(report.checks.map((c) => c.skillNode))];
    const skillNodes = await prisma.skillNode.findMany({
      where: { id: { in: skillNodeIds } },
      include: {
        parent: { select: { id: true, title: true } },
        lessons: {
          include: { lesson: { select: { slug: true, published: true } } },
        },
      },
    });
    const bySkillNode = new Map(skillNodes.map((node) => [node.id, node]));

    const rows: ScoreRow[] = report.checks.map((check) => {
      const node = bySkillNode.get(check.skillNode);
      const category = node?.parent?.title ?? node?.title ?? check.skillNode;
      const lessonSlug = node?.lessons.find((ls) => ls.lesson.published)?.lesson.slug;
      return {
        id: check.id,
        state: check.pass ? "found" : "missed",
        points: check.earned,
        possiblePoints: check.points,
        category,
        title: check.title,
        why: check.error || check.detail,
        lessonHref: lessonSlug ? `/app/lessons/${lessonSlug}` : undefined,
      };
    });

    return { totalEarned: report.totalEarned, totalPossible: report.totalPossible, rows };
  } catch (err) {
    return { error: err instanceof BrokerUnavailableError ? err.message : "Couldn't score the lab." };
  }
}

export interface StopLabResult {
  error?: string;
}

export async function stopLab(labId: string): Promise<StopLabResult> {
  await requireSession();
  try {
    const res = await brokerFetch(`/labs/${encodeURIComponent(labId)}`, { method: "DELETE" });
    if (res.status !== 204) {
      return { error: await brokerErrorMessage(res) };
    }
    return {};
  } catch (err) {
    return { error: err instanceof BrokerUnavailableError ? err.message : "Couldn't stop the lab." };
  }
}
