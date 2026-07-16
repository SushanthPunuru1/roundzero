import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@roundzero/db";
import { Badge, Card, PageHeader, Stat, StatStrip } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { osLabel } from "@/lib/checklists";

export default async function ChecklistsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const templates = await prisma.checklistTemplate.findMany({
    include: { season: { select: { title: true } }, _count: { select: { items: true } } },
    orderBy: { title: "asc" },
  });

  return (
    <div>
      <PageHeader eyebrow="Reference" title="Checklists" />
      <p className="mt-1 text-sm text-text-dim">
        The canonical hardening checklists — every item ties to a skill node and, where one
        exists, a lesson. Read-only for now; team forks land next.
      </p>
      <StatStrip className="mt-6">
        <Stat label="Checklists" value={templates.length} />
        <Stat
          label="Items"
          value={templates.reduce((sum, template) => sum + template._count.items, 0)}
        />
      </StatStrip>

      <div className="mt-8 flex flex-col gap-2">
        {templates.length === 0 ? (
          <Card className="flex flex-col items-start gap-1 p-8">
            <p className="text-base font-semibold text-text">No checklists published yet</p>
            <p className="text-sm text-text-dim">Check back soon.</p>
          </Card>
        ) : (
          templates.map((template) => (
            <Link
              key={template.id}
              href={`/app/checklists/${template.id}`}
              className="group flex items-center justify-between gap-4 rounded-md border border-hairline bg-surface px-4 py-3 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <span className="flex items-center gap-3">
                <Badge>{osLabel(template.os)}</Badge>
                <span className="text-sm font-medium text-text">{template.title}</span>
              </span>
              <span className="flex items-center gap-3 text-xs text-text-dim">
                <span>{template.season.title}</span>
                <span className="font-mono tabular-nums">{template._count.items} items</span>
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
