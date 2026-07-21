import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, CircleCheck, Circle } from "lucide-react";
import { prisma } from "@roundzero/db";
import { Badge, EmptyState, Eyebrow, PageHeader, Stat, StatStrip } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { groupLessonsByDomain, levelLabel } from "@/lib/lessons";

export default async function LessonsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const [lessons, progress, domains] = await Promise.all([
    prisma.lesson.findMany({
      where: { published: true },
      orderBy: [{ domainId: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.lessonProgress.findMany({ where: { userId: session.user.id } }),
    prisma.skillNode.findMany({ where: { kind: "DOMAIN" }, select: { id: true, title: true } }),
  ]);

  const domainTitles = new Map(domains.map((domain) => [domain.id, domain.title]));
  const progressBySlug = new Map(progress.map((row) => [row.lessonSlug, row]));
  const groups = groupLessonsByDomain(lessons, domainTitles);
  const publishedSlugs = new Set(lessons.map((lesson) => lesson.slug));
  const completedCount = progress.filter((row) => publishedSlugs.has(row.lessonSlug)).length;

  return (
    <div>
      <PageHeader eyebrow="Training" title="Lessons" />
      <p className="mt-1 text-sm text-text-dim">
        Short, focused reads with a check at the end. Retake anytime — your best score sticks.
      </p>
      <StatStrip className="mt-6">
        <Stat label="Lessons available" value={lessons.length} />
        <Stat label="Completed" value={`${completedCount}/${lessons.length}`} />
      </StatStrip>

      <div className="mt-8 flex flex-col gap-8">
        {groups.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            message="No lessons published yet — check back soon, new lessons are added regularly."
          />
        ) : (
          groups.map((group) => (
            <section key={group.domainId}>
              <Eyebrow as="h2">{group.domainTitle}</Eyebrow>
              <div className="mt-3 flex flex-col gap-2">
                {group.lessons.map((lesson) => {
                  const best = progressBySlug.get(lesson.slug);
                  const completed = best !== undefined;
                  return (
                    <Link
                      key={lesson.slug}
                      href={`/app/lessons/${lesson.slug}`}
                      className="group flex items-center justify-between gap-4 rounded-md border border-hairline bg-surface px-4 py-3 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <span className="flex items-center gap-3">
                        {completed ? (
                          <CircleCheck
                            className="size-4 shrink-0 text-score"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                        ) : (
                          <Circle
                            className="size-4 shrink-0 text-text-dim"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                        )}
                        <span className="text-sm font-medium text-text">{lesson.title}</span>
                        <span className="sr-only">
                          {completed
                            ? `Completed, best score ${best.checkScore ?? 0}%`
                            : "Not completed"}
                        </span>
                      </span>
                      <span className="flex items-center gap-3 text-xs text-text-dim">
                        {completed && (
                          <span className="font-mono tabular-nums text-score">
                            {best.checkScore ?? 0}%
                          </span>
                        )}
                        <Badge>{levelLabel(lesson.level)}</Badge>
                        <span className="font-mono tabular-nums">{lesson.minutes} min</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
