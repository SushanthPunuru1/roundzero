import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

// Re-exported so consumers (e.g. apps/web) don't need their own
// `@prisma/client` dependency just for enum types/values.
export { Division, MachineRole, TrackLevel } from "@prisma/client";

// Re-exported so apps/web can parse/grade a lesson MDX file it reads from
// packages/content without duplicating the frontmatter contract (README.md
// in packages/content/lessons) or the check-grading math.
export { LessonError, parseLesson } from "./lessons/parse";
export type { CheckQuestion, LessonMeta, ParsedLesson } from "./lessons/parse";
export { bestScore, gradeCheck } from "./lessons/grade";
export type { GradeResult } from "./lessons/grade";
