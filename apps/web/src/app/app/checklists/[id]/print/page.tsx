import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma, resolveFork } from "@roundzero/db";
import { Checkbox } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { commandEntries, commandLabel, osLabel } from "@/lib/checklists";
import {
  NO_TEAM_NAME,
  NO_TEAM_SLUG,
  formatRecordId,
  toForkItemRow,
  toUpstreamItem,
  versionLabel,
} from "@/lib/checklist-fork";
import { loadForkForViewer } from "@/lib/checklist-access";
import { PrintButton } from "./print-button";

interface PrintItem {
  id: string;
  action: string;
  why: string;
  commands: Record<string, string>;
  isTeamAdded: boolean;
}

export default async function ChecklistPrintPage({
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
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) {
    notFound();
  }

  // The print route works with or without a fork — personal or team-owned.
  // The organization lookup is only for the printed header; a solo learner
  // has none and still gets a real header, never a blank team name/slug
  // (DESIGN.md: no placeholder voids).
  const member = await prisma.member.findFirst({ where: { userId: session.user.id } });
  const organization = member
    ? await prisma.organization.findUnique({ where: { id: member.organizationId } })
    : null;
  const { fork: teamChecklist } = await loadForkForViewer(session.user.id, id);

  let items: PrintItem[];
  if (teamChecklist) {
    const upstream = template.items.map(toUpstreamItem);
    const forkRows = teamChecklist.items.map(toForkItemRow);
    const resolved = resolveFork(forkRows, upstream)
      .filter((item) => !item.removed)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    items = resolved.map((item) => ({
      id: item.id,
      action: item.action,
      why: item.why,
      commands: item.commands,
      isTeamAdded: item.origin === "team-added",
    }));
  } else {
    items = template.items.map((item) => ({
      id: item.id,
      action: item.action,
      why: item.why,
      commands: item.commands as Record<string, string>,
      isTeamAdded: false,
    }));
  }

  const teamName = organization?.name ?? NO_TEAM_NAME;
  const teamSlug = organization?.slug ?? NO_TEAM_SLUG;
  const generatedAt = new Date();
  // Authority is the TEMPLATE's current version, not the fork's
  // sourceVersion: resolveFork merges every inherited field against current
  // upstream, so a fork made at v1 already prints v2-derived text once
  // upstream has moved on. versionLabel surfaces the fork's original
  // sourceVersion alongside it only when the two actually differ.
  const recordId = formatRecordId({
    templateId: template.id,
    version: template.version,
    teamSlug,
    date: generatedAt,
  });
  const version = versionLabel(template.version, teamChecklist?.sourceVersion ?? null);

  return (
    <div className="datasheet bg-bg p-8 text-text print:p-10">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <p className="text-sm text-text-dim">
          Print preview — use your browser's print dialog to save as PDF.
        </p>
        <PrintButton />
      </div>

      <header className="mt-6 flex flex-col gap-3 border-b-2 border-hairline pb-4 print:mt-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h1 className="text-[25px] font-semibold leading-[32px] text-text">{template.title}</h1>
          <p className="font-mono text-xs tabular-nums text-text-dim">{recordId}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.06em] text-text-dim">Team</dt>
            <dd className="text-text">{teamName}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.06em] text-text-dim">OS</dt>
            <dd className="text-text">{osLabel(template.os)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.06em] text-text-dim">Version</dt>
            <dd className="font-mono tabular-nums text-text">{version}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.06em] text-text-dim">Generated</dt>
            <dd className="font-mono tabular-nums text-text">
              {generatedAt.toISOString().slice(0, 10)}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-6 flex flex-col">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex gap-3 border-b border-hairline py-3 break-inside-avoid last:border-b-0"
          >
            <Checkbox className="mt-1" aria-label={`Item ${index + 1}`} />
            <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-text-dim">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">
                {item.action}
                {item.isTeamAdded && (
                  <span className="ml-2 rounded-sm border border-hairline px-1.5 py-0.5 text-[11px] uppercase tracking-[0.06em] text-text-dim">
                    Team-added
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-text-dim">{item.why}</p>
              {commandEntries(item.commands).length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {commandEntries(item.commands).map(([key, command]) => (
                    <div key={key} className="rounded-sm border border-hairline bg-surface-2 p-2">
                      <p className="text-[10px] uppercase tracking-[0.06em] text-text-dim">
                        {commandLabel(key)}
                      </p>
                      <pre className="mt-0.5 whitespace-pre-wrap break-words font-mono text-[12px] leading-[17px] text-text">
                        {command}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
