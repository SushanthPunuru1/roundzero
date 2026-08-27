"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@roundzero/db";
import type { ScoreLineState } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { enqueueSkillNodeCards } from "@/lib/drill";
import {
  WS_TOKEN_TTL_SECONDS,
  labAuthHeader,
  labTokenSecret,
  mintLabToken,
  nowSeconds,
} from "@/lib/lab-token";

const BROKER_TIMEOUT_MS = 5000;

class BrokerUnavailableError extends Error {}

function brokerBaseUrl(): string | null {
  return process.env.LAB_BROKER_URL || null;
}

/** apps/web never opens the terminal socket itself — it only returns the
 * broker's own ws:// URL, which the browser connects to directly (a
 * WebSocket can't be proxied through a Vercel serverless function; see
 * docs/DECISIONS.md 027).
 *
 * The token rides in the query string because the browser WebSocket API
 * cannot set headers. That is why it is minted with a short TTL: a query
 * string ends up in access and proxy logs, so it has to be useless by the
 * time anyone reads one. */
function wsUrlFor(base: string, labId: string, userId: string): string {
  const url = `${base.replace(/^http/, "ws")}/labs/${labId}/term`;
  const secret = labTokenSecret();
  if (!secret) return url;
  const token = mintLabToken(
    { userId, labId, expiresAt: nowSeconds() + WS_TOKEN_TTL_SECONDS },
    secret,
  );
  return `${url}?t=${encodeURIComponent(token)}`;
}

/** `labId` scopes the minted token to one lab; pass null for lab creation,
 * where no id exists yet. */
async function brokerFetch(
  path: string,
  userId: string,
  labId: string | null,
  init?: RequestInit,
): Promise<Response> {
  const base = brokerBaseUrl();
  if (!base) {
    throw new BrokerUnavailableError(
      "The lab broker isn't configured for this deployment — this feature is local-only. See lab-broker/README.md.",
    );
  }
  try {
    return await fetch(`${base}${path}`, {
      ...init,
      headers: { ...init?.headers, ...labAuthHeader(userId, labId) },
      signal: AbortSignal.timeout(BROKER_TIMEOUT_MS),
    });
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
  const session = await requireSession();
  try {
    const res = await brokerFetch("/labs", session.user.id, null, { method: "POST" });
    if (res.status !== 201) {
      return { error: await brokerErrorMessage(res) };
    }
    const body = (await res.json()) as { id: string };
    return { labId: body.id, wsUrl: wsUrlFor(brokerBaseUrl()!, body.id, session.user.id) };
  } catch (err) {
    return { error: err instanceof BrokerUnavailableError ? err.message : "Couldn't launch the lab." };
  }
}

export interface ResumeLabResult {
  labId?: string;
  wsUrl?: string;
  error?: string;
}

/**
 * Finds the caller's already-running lab, if any, and returns a freshly
 * minted terminal URL for it.
 *
 * Two problems this solves, both of which strand a learner otherwise:
 *
 * - **A dropped socket.** The container keeps running; only the WebSocket
 *   died. Without this the terminal is unreachable and the lab sits burning
 *   its lifetime until the idle sweep takes it.
 * - **A reload, or coming back later.** Same situation, arrived at
 *   deliberately.
 *
 * Both got worse with the per-user quota (DECISIONS 047): "just launch
 * another" now fails, because the stranded lab still counts against the
 * learner's allowance. Reconnecting is the only correct answer.
 *
 * `GET /labs` is owner-scoped broker-side, so this can only ever return a
 * lab belonging to the caller.
 */
export async function resumeLab(): Promise<ResumeLabResult> {
  const session = await requireSession();
  try {
    const res = await brokerFetch("/labs", session.user.id, null, { method: "GET" });
    if (res.status !== 200) {
      return { error: await brokerErrorMessage(res) };
    }
    const body = (await res.json()) as { labs: { id: string }[] };
    const existing = body.labs[0];
    if (!existing) return {};
    return { labId: existing.id, wsUrl: wsUrlFor(brokerBaseUrl()!, existing.id, session.user.id) };
  } catch (err) {
    // A broker that isn't running is the normal local case, not an error
    // worth surfacing on page load — the launch button reports it clearly
    // enough when actually pressed.
    return { error: err instanceof BrokerUnavailableError ? undefined : "Couldn't check for a running lab." };
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
  skillNode: string;
}

export interface ScoreLabResult {
  totalEarned?: number;
  totalPossible?: number;
  rows?: ScoreRow[];
  error?: string;
}

export async function scoreLab(labId: string): Promise<ScoreLabResult> {
  const session = await requireSession();
  try {
    const res = await brokerFetch(`/labs/${encodeURIComponent(labId)}/score`, session.user.id, labId, {
      method: "POST",
    });
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
        skillNode: check.skillNode,
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
  const session = await requireSession();
  try {
    const res = await brokerFetch(`/labs/${encodeURIComponent(labId)}`, session.user.id, labId, {
      method: "DELETE",
    });
    if (res.status !== 204) {
      return { error: await brokerErrorMessage(res) };
    }
    return {};
  } catch (err) {
    return { error: err instanceof BrokerUnavailableError ? err.message : "Couldn't stop the lab." };
  }
}

export interface EnqueueMissedDrillsResult {
  enqueuedCount: number;
}

/**
 * Enqueues the missed checks' skill nodes' drill cards into the user's SRS
 * queue — mirrors lesson completion's `enqueueLessonCards`. Called once the
 * debrief renders; idempotent (safe to call again on re-score or re-viewing
 * the same debrief — only genuinely new cards count toward the result).
 */
export async function enqueueMissedDrills(skillNodeIds: string[]): Promise<EnqueueMissedDrillsResult> {
  const session = await requireSession();
  const enqueuedCount = await enqueueSkillNodeCards(session.user.id, skillNodeIds, new Date());
  return { enqueuedCount };
}
