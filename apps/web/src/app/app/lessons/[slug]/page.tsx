import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { compileMDX } from "next-mdx-remote/rsc";
import { prisma } from "@roundzero/db";
import { Badge } from "@roundzero/ui";

import { auth } from "@/lib/auth";
import { loadLessonBySlug } from "@/lib/lesson-content";
import { levelLabel } from "@/lib/lessons";
import { lessonComponents } from "./mdx-components";
import { LessonCheck } from "./lesson-check";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const lesson = loadLessonBySlug(slug);
  if (!lesson || !lesson.meta.published) {
    notFound();
  }

  const [progress, { content }] = await Promise.all([
    prisma.lessonProgress.findUnique({
      where: { userId_lessonSlug: { userId: session.user.id, lessonSlug: lesson.meta.slug } },
    }),
    compileMDX({ source: lesson.body, components: lessonComponents }),
  ]);

  return (
    <div>
      <Link
        href="/app/lessons"
        className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        Lessons
      </Link>

      <h1 className="mt-3 text-[25px] font-semibold leading-[32px] text-text">
        {lesson.meta.title}
      </h1>
      <div className="mt-2 flex items-center gap-3 text-sm text-text-dim">
        <Badge>{levelLabel(lesson.meta.level)}</Badge>
        <span className="font-mono tabular-nums">{lesson.meta.minutes} min</span>
      </div>

      <article className="mt-8 max-w-[68ch]">{content}</article>

      <LessonCheck
        slug={lesson.meta.slug}
        questions={lesson.meta.check.map((question) => ({
          q: question.q,
          options: question.options,
        }))}
        initialBestScore={progress?.checkScore ?? null}
      />
    </div>
  );
}
