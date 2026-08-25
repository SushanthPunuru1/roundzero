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
export {
  Division,
  MachineRole,
  TrackLevel,
  OS,
  CardType,
  ForensicsArchetype,
  EventKind,
  MeetingCadence,
  Weekday,
} from "@prisma/client";

// `Prisma.DbNull` is the sentinel a nullable Json column needs to actually
// clear it — a bare JS `null` is ambiguous for Json fields, so the checklist
// fork write-path (revert-to-upstream on `commands`) needs this re-export
// too rather than taking a direct `@prisma/client` dependency in apps/web.
export { Prisma } from "@prisma/client";

// Re-exported so apps/web can parse/grade a lesson MDX file it reads from
// packages/content without duplicating the frontmatter contract (README.md
// in packages/content/lessons) or the check-grading math.
export { LessonError, parseLesson } from "./lessons/parse";
export type { CheckQuestion, LessonMeta, ParsedLesson } from "./lessons/parse";
export { bestScore, gradeCheck } from "./lessons/grade";
export type { GradeResult } from "./lessons/grade";

// Spaced-repetition surface (Milestone 3) — apps/web drives the drill
// through these instead of importing ts-fsrs or writing scheduling math.
export { newCardState, scheduleReview, Rating } from "./srs/schedule";
export type { CardState } from "./srs/schedule";
export { dueCards, selectNewFoundationsCards } from "./srs/select";
export type { DueableState, SelectableCard } from "./srs/select";
export { computeStreak } from "./srs/streak";
export { PLATFORM_TIME_ZONE, DAILY_NEW_CARD_CAP, localDateKey } from "./srs/day";

// Forensics question bank (Part A) — apps/web parses the same content-as-code
// YAML at request time (mirrors loadLessonBySlug/parseLesson above) so the
// answer key never lives in the DB or ships to the client until a question
// has actually been graded.
export { ForensicsError, parseForensics, parseForensicsFile, toForensicsRow, validateForensicsRefs, FORENSICS_ARCHETYPES } from "./forensics/parse";
export type { DesiredForensicsQuestion, ForensicsQuestionRow, ForensicsArchetypeInfo } from "./forensics/parse";

// Generic quiz engine (DECISIONS 033) — the forensics grading math above was
// already domain-agnostic, so it now lives here and forensics imports it
// under its historical names (aliased below) rather than duplicating it.
// Any future quiz bank (Cisco Part C1's networking quiz today) reuses this
// same grading + parse/reconcile pair instead of forking forensics' pattern.
export { gradeAnswer, normalizeAnswer } from "./quiz/grade";
export type {
  QuizAnswerSpec,
  FormatDiff,
  GradeStatus as QuizGradeStatus,
  GradeResult as QuizGradeResult,
} from "./quiz/grade";
export type {
  QuizAnswerSpec as ForensicsAnswerSpec,
  GradeStatus as ForensicsGradeStatus,
  GradeResult as ForensicsGradeResult,
} from "./quiz/grade";
export { QuizError, parseQuiz, parseQuizFile, toQuizRow, validateQuizRefs } from "./quiz/parse";
export type { DesiredQuizQuestion, QuizQuestionRow } from "./quiz/parse";

// Placement (ONBOARDING_PATH_SPEC.md Part A) — a dedicated multiple-choice
// bank read straight from packages/content/placement at request time (no DB
// table backs the questions themselves; see placement/ladder.ts's header).
// apps/web's placement server action imports parse + ladder from here so the
// answer key and the adaptive stepping logic both stay out of the client.
export {
  PlacementError,
  parsePlacement,
  parsePlacementFile,
  toPublicQuestion,
  validatePlacementCoverage,
  validatePlacementRefs,
  PLACEMENT_DOMAINS,
  PLACEMENT_TIERS,
} from "./placement/parse";
export type {
  DesiredPlacementQuestion,
  PlacementDomain,
  PlacementQuestionPublic,
  PlacementTier,
} from "./placement/parse";
export {
  NOT_SURE,
  QUESTIONS_PER_DOMAIN,
  TOTAL_QUESTIONS,
  earlyExitLevels,
  gradeAnswer as gradePlacementAnswer,
  mapLevels as mapPlacementLevels,
  nextStep as nextPlacementStep,
  recordAnswer as recordPlacementAnswer,
} from "./placement/ladder";
export type { NextStep as PlacementNextStep, PlacementAnswer } from "./placement/ladder";

// Recommended-track generator (ONBOARDING_PATH_SPEC.md Part B) — pure, derived
// on read. apps/web/src/lib/track.ts loads the inputs (placement + progress +
// published lessons) from Prisma and calls generateTrack.
// Team checklist fork/diff (ROADMAP M2). Pure — apps/web loads the rows and
// calls these, same shape as the track generator below.
export { diffFork, initialForkItems, isCleanFork, reorder, resolveFork } from "./checklists/fork";
export type { ForkDiff, ForkItemRow, ResolvedItem, UpstreamItem } from "./checklists/fork";

// Fork ownership: a fork belongs to exactly one of a user or an organization.
// Personal forks exist because organization-only scoping made the trio above
// unreachable for a learner with no team — DECISIONS 043.
export {
  canEditFork,
  canEditTeamFork,
  canViewFork,
  forkOwnerKind,
  forkOwnerLabel,
} from "./checklists/ownership";
export type { ForkOwner, ForkOwnerKind, ForkViewer } from "./checklists/ownership";

export { FALLBACK_LESSON_REASON, generateTrack, linuxLabReady, resolveFocusDomains } from "./track/generate";
export type {
  FocusMachine,
  TrackDomain,
  TrackInput,
  TrackLesson,
  TrackStep,
  TrackStepKind,
  TrackStepStatus,
} from "./track/generate";
