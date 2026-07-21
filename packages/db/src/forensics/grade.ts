// Pure grading for forensics question-bank answers. No DB/framework imports.
// Real CyberPatriot forensics answers are auto-graded exact strings, so this
// mirrors that: trim always applies, case/trailing-slash normalization are
// per-question. A "close" result (right content, wrong format) carries a
// FormatDiff describing exactly what didn't match, so the UI can teach the
// answer-format discipline instead of just saying "incorrect."

export interface ForensicsAnswerSpec {
  answer: string;
  accepts: string[];
  caseSensitive: boolean;
  stripTrailingSlash: boolean;
}

export interface FormatDiff {
  caseMismatch: boolean;
  trailingSlashMismatch: boolean;
  whitespaceMismatch: boolean;
}

export type GradeStatus = "correct" | "close" | "incorrect";

export interface GradeResult {
  status: GradeStatus;
  diff?: FormatDiff;
}

interface NormalizeOptions {
  caseSensitive: boolean;
  stripTrailingSlash: boolean;
  collapseWhitespace: boolean;
}

/**
 * Normalizes a raw answer string for comparison. Trim always applies (the
 * one normalization CyberPatriot's own answer keys are forgiving about);
 * case-folding, trailing-slash stripping, and internal-whitespace collapsing
 * are each opt-in, since real answer keys are genuinely inconsistent about
 * all three.
 */
export function normalizeAnswer(value: string, options: NormalizeOptions): string {
  let out = value.trim();
  if (options.collapseWhitespace) out = out.replace(/\s+/g, " ");
  if (!options.caseSensitive) out = out.toLowerCase();
  if (options.stripTrailingSlash) out = out.replace(/\/+$/, "");
  return out;
}

const LOOSE: NormalizeOptions = {
  caseSensitive: false,
  stripTrailingSlash: true,
  collapseWhitespace: true,
};

/**
 * Grades a submitted answer against a question's answer spec.
 * - "correct": matches `answer` or any `accepts[]` entry under the
 *   question's own normalization rules.
 * - "close": doesn't match under strict rules, but does under fully lenient
 *   normalization (case-insensitive, trailing slash stripped, whitespace
 *   collapsed) — right content, wrong format. `diff` names which axis (or
 *   axes) actually differ, driving specific feedback.
 * - "incorrect": no candidate matches even loosely.
 */
export function gradeAnswer(spec: ForensicsAnswerSpec, submitted: string): GradeResult {
  const candidates = [spec.answer, ...spec.accepts];
  const strictOptions: NormalizeOptions = {
    caseSensitive: spec.caseSensitive,
    stripTrailingSlash: spec.stripTrailingSlash,
    collapseWhitespace: false,
  };

  const strictSubmitted = normalizeAnswer(submitted, strictOptions);
  if (candidates.some((candidate) => normalizeAnswer(candidate, strictOptions) === strictSubmitted)) {
    return { status: "correct" };
  }

  const looseSubmitted = normalizeAnswer(submitted, LOOSE);
  const closeCandidate = candidates.find(
    (candidate) => normalizeAnswer(candidate, LOOSE) === looseSubmitted,
  );
  if (!closeCandidate) {
    return { status: "incorrect" };
  }

  // Each axis is tested with the OTHER two axes fully relaxed, so a
  // compound mismatch (e.g. wrong case AND a stray trailing slash at once)
  // still attributes each contributing axis correctly, not just the single
  // axis that would happen to resolve it in isolation.
  const caseAxis: NormalizeOptions = {
    caseSensitive: spec.caseSensitive,
    stripTrailingSlash: true,
    collapseWhitespace: true,
  };
  const slashAxis: NormalizeOptions = {
    caseSensitive: false,
    stripTrailingSlash: spec.stripTrailingSlash,
    collapseWhitespace: true,
  };
  const whitespaceAxis: NormalizeOptions = {
    caseSensitive: false,
    stripTrailingSlash: true,
    collapseWhitespace: false,
  };

  const diff: FormatDiff = {
    caseMismatch:
      spec.caseSensitive &&
      normalizeAnswer(submitted, caseAxis) !== normalizeAnswer(closeCandidate, caseAxis),
    trailingSlashMismatch:
      !spec.stripTrailingSlash &&
      normalizeAnswer(submitted, slashAxis) !== normalizeAnswer(closeCandidate, slashAxis),
    whitespaceMismatch:
      normalizeAnswer(submitted, whitespaceAxis) !== normalizeAnswer(closeCandidate, whitespaceAxis),
  };

  return { status: "close", diff };
}
