import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { prisma } from "@roundzero/db";
import { Badge, Eyebrow, PageHeader } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import {
  commandEntries,
  commandLabel,
  groupItemsIntoSections,
  osLabel,
  type ChecklistItemView,
} from "@/lib/checklists";
import { CommandBlock } from "./command-block";

export default async function ChecklistDetailPage({
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
    include: {
      season: { select: { title: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: { skillNode: { include: { parent: true } } },
      },
    },
  });
  if (!template) {
    notFound();
  }

  const itemViews: ChecklistItemView[] = template.items.map((item) => ({
    id: item.id,
    skillNodeId: item.skillNodeId,
    sortOrder: item.sortOrder,
    action: item.action,
    why: item.why,
    commands: item.commands as Record<string, string>,
    lessonSlug: item.lessonSlug,
    caution: item.caution,
    categoryId: item.skillNode.parent?.id ?? item.skillNode.id,
    categoryTitle: item.skillNode.parent?.title ?? item.skillNode.title,
  }));

  const sections = groupItemsIntoSections(itemViews);
  const tocSections = sections.filter((section) => section.headerTitle !== null);

  return (
    <div>
      <Link
        href="/app/checklists"
        className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        Checklists
      </Link>

      <PageHeader
        className="mt-3"
        eyebrow={template.season.title}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Badge>{osLabel(template.os)}</Badge>
            {template.title}
          </span>
        }
      />
      <p className="mt-1 font-mono text-sm tabular-nums text-text-dim">
        {template.items.length} items
      </p>

      <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-start">
        {tocSections.length > 0 && (
          <nav
            aria-label="Sections on this page"
            className="shrink-0 md:sticky md:top-20 md:w-56"
          >
            <Eyebrow>On this page</Eyebrow>
            <ul className="mt-2 flex flex-col gap-0.5">
              {tocSections.map((section) => (
                <li key={section.anchor}>
                  <a
                    href={`#${section.anchor}`}
                    className="flex items-center justify-between gap-2 rounded-[3px] px-1.5 py-1 text-sm text-text-dim transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    <span>{section.headerTitle}</span>
                    <span className="font-mono tabular-nums text-xs">{section.items.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="min-w-0 flex-1">
          {sections.map((section, sectionIndex) => (
            <section
              key={`${section.categoryId}-${sectionIndex}`}
              id={section.anchor ?? undefined}
              className="scroll-mt-20"
            >
              {section.headerTitle && (
                <h2 className="mt-8 text-[20px] font-semibold leading-[28px] text-text first:mt-0">
                  {section.headerTitle}
                </h2>
              )}
              <div className="divide-y divide-hairline border-y border-hairline first:mt-4 [&:not(:first-child)]:mt-4">
                {section.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 py-4">
                    <ChevronRight
                      className="mt-0.5 size-4 shrink-0 text-text-dim"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
                        <p className="text-sm font-medium text-text">{item.action}</p>
                        <Badge className="shrink-0">{item.categoryTitle}</Badge>
                      </div>
                      <p className="mt-1 text-sm leading-[20px] text-text-dim">{item.why}</p>

                      {item.caution && (
                        <div className="mt-2 flex items-start gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-text">
                          <TriangleAlert
                            className="mt-0.5 size-4 shrink-0 text-accent"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                          <span>{item.caution}</span>
                        </div>
                      )}

                      {item.lessonSlug && (
                        <Link
                          href={`/app/lessons/${item.lessonSlug}`}
                          className="mt-2 inline-block text-sm text-accent underline underline-offset-2 hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                        >
                          Lesson &rarr;
                        </Link>
                      )}

                      <div className="mt-3 flex flex-col gap-2">
                        {commandEntries(item.commands).map(([key, command]) => (
                          <CommandBlock key={key} label={commandLabel(key)} command={command} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
