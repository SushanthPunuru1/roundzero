// The adaptive placement ladder (ONBOARDING_PATH_SPEC.md Part A) — pure,
// no IRT: a simple per-domain difficulty pointer that steps up one tier on
// a correct answer and down one tier (floored at foundations) on an
// incorrect or "I'm not sure yet" answer. No DB/framework imports; the
// server action in apps/web is the only thing that touches Prisma or the
// content filesystem.
//
// Deliberately no PlacementQuestion DB table: questions are read
// server-side, transiently, straight from packages/content/placement (see
// apps/web/src/lib/placement-content.ts) for each step of the flow — no
// per-user, per-question progress is ever tracked (unlike lessons/forensics/
// quiz), so there is nothing for a DB row to index. The seed script still
// validates the bank (parse.ts) so a bad ref fails loudly at seed time.

import type { TrackLevel } from "../taxonomy/parse";
import {
  PLACEMENT_DOMAINS,
  PLACEMENT_TIERS,
  toPublicQuestion,
  type DesiredPlacementQuestion,
  type PlacementDomain,
  type PlacementQuestionPublic,
  type PlacementTier,
} from "./parse";

/** Questions per domain, and the domain block order (foundations first) —
 * the check asks all of one domain before moving to the next. */
export const QUESTIONS_PER_DOMAIN = 3;
export const TOTAL_QUESTIONS = PLACEMENT_DOMAINS.length * QUESTIONS_PER_DOMAIN;

/** Sentinel choice value for "I'm not sure yet" — never a real options[]
 * index (those are always >= 0), so it can't collide with an authored
 * `answer`. The UI appends this as the last radio on every question; it is
 * never authored per-question in the YAML. */
export const NOT_SURE = -1;

export interface PlacementAnswer {
  questionId: string;
  domain: PlacementDomain;
  tier: PlacementTier;
  choice: number;
  correct: boolean;
}

export interface NextStepQuestion {
  done: false;
  question: PlacementQuestionPublic;
  /** True at exactly one point: about to serve the 2nd question overall,
   * when the 1st (foundations/foundations) was missed or "not sure". An
   * *offer*, never automatic — see apps/web's placement-flow.tsx. */
  offerEarlyExit: boolean;
}

export interface NextStepDone {
  done: true;
  levels: Record<PlacementDomain, TrackLevel>;
}

export type NextStep = NextStepQuestion | NextStepDone;

const LEVEL_BY_TIER_INDEX: TrackLevel[] = ["FOUNDATIONS", "STANDARD", "ADVANCED"];

function tierIndex(tier: PlacementTier): number {
  return PLACEMENT_TIERS.indexOf(tier);
}

function stepTier(tier: PlacementTier, correct: boolean): PlacementTier {
  const next = tierIndex(tier) + (correct ? 1 : -1);
  const clamped = Math.max(0, Math.min(PLACEMENT_TIERS.length - 1, next));
  return PLACEMENT_TIERS[clamped]!;
}

function domainForIndex(index: number): PlacementDomain {
  return PLACEMENT_DOMAINS[Math.floor(index / QUESTIONS_PER_DOMAIN)]!;
}

/** Replays `history` to find a domain's current difficulty pointer — always
 * starts at "foundations" and has no history to replay for the first
 * question asked in that domain. */
function currentTierForDomain(domain: PlacementDomain, history: PlacementAnswer[]): PlacementTier {
  let tier: PlacementTier = "foundations";
  for (const answer of history) {
    if (answer.domain !== domain) continue;
    tier = stepTier(answer.tier, answer.correct);
  }
  return tier;
}

/**
 * Picks the first unused question (by sortOrder) at (domain, tier).
 * Deterministic — no randomness, so a given answer history always produces
 * the same next question (aids testing and makes a retake vary only by the
 * user's own answers). Falls back to the nearest other tier in the same
 * domain if the exact tier is exhausted — defensive only; validatePlacementCoverage's
 * floor should keep this from ever triggering — and null only if the whole
 * domain is exhausted, in which case the caller ends the check early rather
 * than crashing.
 */
function pickQuestion(
  bank: DesiredPlacementQuestion[],
  domain: PlacementDomain,
  tier: PlacementTier,
  usedIds: Set<string>,
): DesiredPlacementQuestion | null {
  const candidates = bank
    .filter((question) => question.domain === domain && !usedIds.has(question.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const exact = candidates.find((question) => question.tier === tier);
  if (exact) return exact;

  const byDistance = [...PLACEMENT_TIERS].sort(
    (a, b) => Math.abs(tierIndex(a) - tierIndex(tier)) - Math.abs(tierIndex(b) - tierIndex(tier)),
  );
  for (const fallbackTier of byDistance) {
    const found = candidates.find((question) => question.tier === fallbackTier);
    if (found) return found;
  }
  return null;
}

/** choice === NOT_SURE is always incorrect — "not sure" is an honest,
 * non-punished answer to the user, but it still nudges the ladder easier
 * internally, exactly like a wrong answer. */
export function gradeAnswer(question: DesiredPlacementQuestion, choice: number): boolean {
  return choice !== NOT_SURE && choice === question.answer;
}

/** Reconstructs one authoritative PlacementAnswer from a raw client
 * submission — never trusts a client-reported domain/tier/correctness, only
 * `questionId` + `choice`, both re-checked against the real bank. */
export function recordAnswer(
  bank: DesiredPlacementQuestion[],
  questionId: string,
  choice: number,
): PlacementAnswer {
  const question = bank.find((candidate) => candidate.id === questionId);
  if (!question) {
    throw new RangeError(`unknown placement question id "${questionId}"`);
  }
  return {
    questionId: question.id,
    domain: question.domain,
    tier: question.tier,
    choice,
    correct: gradeAnswer(question, choice),
  };
}

/** Per domain, the level is the highest tier ever answered correctly,
 * floored at FOUNDATIONS — nothing correct in a domain still resolves to
 * FOUNDATIONS (the non-punishing floor: "start at the beginning," never
 * "failed"), never a lower/error state. */
export function mapLevels(history: PlacementAnswer[]): Record<PlacementDomain, TrackLevel> {
  const levels = {} as Record<PlacementDomain, TrackLevel>;
  for (const domain of PLACEMENT_DOMAINS) {
    const correctTierIndexes = history
      .filter((answer) => answer.domain === domain && answer.correct)
      .map((answer) => tierIndex(answer.tier));
    const best = correctTierIndexes.length > 0 ? Math.max(...correctTierIndexes) : 0;
    levels[domain] = LEVEL_BY_TIER_INDEX[best]!;
  }
  return levels;
}

/** The early-exit result: every domain placed at FOUNDATIONS. */
export function earlyExitLevels(): Record<PlacementDomain, TrackLevel> {
  const levels = {} as Record<PlacementDomain, TrackLevel>;
  for (const domain of PLACEMENT_DOMAINS) levels[domain] = "FOUNDATIONS";
  return levels;
}

/**
 * Given the full answer history so far, decides what happens next: the next
 * question (with whether to offer the early-exit off-ramp), or the final
 * per-domain levels once all TOTAL_QUESTIONS have been answered.
 */
export function nextStep(history: PlacementAnswer[], bank: DesiredPlacementQuestion[]): NextStep {
  if (history.length >= TOTAL_QUESTIONS) {
    return { done: true, levels: mapLevels(history) };
  }

  const index = history.length;
  const domain = domainForIndex(index);
  const tier = currentTierForDomain(domain, history);
  const usedIds = new Set(history.map((answer) => answer.questionId));
  const question = pickQuestion(bank, domain, tier, usedIds);
  if (!question) {
    return { done: true, levels: mapLevels(history) };
  }

  const offerEarlyExit = index === 1 && !history[0]!.correct;
  return { done: false, question: toPublicQuestion(question), offerEarlyExit };
}
