import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma, diffFork } from "@roundzero/db";
import { Badge, PageHeader } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { osLabel } from "@/lib/checklists";
import { toForkItemRow, toUpstreamItem } from "@/lib/checklist-fork";
import { loadForkForViewer } from "@/lib/checklist-access";
import { DiffView, type DiffViewData } from "./diff-view";

export default async function ChecklistDiffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { id },
    include: { season: { select: { title: true } }, items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) {
    notFound();
  }

  const { fork: teamChecklist, canEdit } = await loadForkForViewer(session.user.id, id);

  // No fork to diff against — nothing to show here.
  if (!teamChecklist) {
    redirect(`/app/checklists/${id}`);
  }

  const upstream = template.items.map(toUpstreamItem);
  const forkRows = teamChecklist.items.map(toForkItemRow);
  const diff = diffFork(forkRows, upstream);

  const rowByUpstreamId = new Map(
    teamChecklist.items.filter((row) => row.upstreamItemId !== null).map((row) => [row.upstreamItemId!, row]),
  );

  const data: DiffViewData = {
    teamChecklistId: teamChecklist.id,
    canEdit,
    teamAddedCount: diff.teamAdded,
    updatedConflicting: diff.updatedConflicting.map((entry) => {
      const row = rowByUpstreamId.get(entry.item.id);
      return {
        upstreamItemId: entry.item.id,
        teamRowId: row?.id ?? entry.item.id,
        action: entry.item.action,
        fields: entry.fields,
        upstreamValues: { action: entry.item.action, why: entry.item.why, commands: entry.item.commands },
        teamValues: entry.teamValues,
      };
    }),
    added: diff.added.map((item) => ({ upstreamItemId: item.id, action: item.action, why: item.why })),
    removedByTeam: diff.removedByTeam.map((item) => {
      const row = rowByUpstreamId.get(item.id);
      return { upstreamItemId: item.id, teamRowId: row?.id ?? item.id, action: item.action };
    }),
    retiredUpstream: diff.retiredUpstream.map((upstreamItemId) => {
      const row = rowByUpstreamId.get(upstreamItemId);
      return { upstreamItemId, action: row?.action ?? null };
    }),
  };

  return (
    <div>
      <Link
        href={`/app/checklists/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        {template.title}
      </Link>

      <PageHeader
        className="mt-3"
        eyebrow={template.season.title}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Badge>{osLabel(template.os)}</Badge>
            Diff against upstream
          </span>
        }
        support="What upstream changed since you forked, and what to do about it."
      />

      <div className="mt-8">
        <DiffView data={data} />
      </div>
    </div>
  );
}
