// Pure parse/validate/shape of rzagent's `--json` output (agent/internal/report)
// into the broker's HTTP response shape. No Docker, no I/O — the broker only
// captures rzagent's stdout and hands the string to shapeReport.

export interface ScoreCheckLine {
  id: string;
  title: string;
  skillNode: string;
  points: number;
  earned: number;
  pass: boolean;
  detail: string;
  error?: string;
  timestamp: string;
}

export interface ScoreReport {
  generatedAt: string;
  totalPossible: number;
  totalEarned: number;
  checks: ScoreCheckLine[];
}

export class ScoreParseError extends Error {
  constructor(reason: string) {
    super(`Could not parse the score report: ${reason}`);
    this.name = "ScoreParseError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string") {
    throw new ScoreParseError(`expected "${key}" to be a string`);
  }
  return value;
}

function requireNumber(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  if (typeof value !== "number") {
    throw new ScoreParseError(`expected "${key}" to be a number`);
  }
  return value;
}

function requireBoolean(obj: Record<string, unknown>, key: string): boolean {
  const value = obj[key];
  if (typeof value !== "boolean") {
    throw new ScoreParseError(`expected "${key}" to be a boolean`);
  }
  return value;
}

function shapeCheckLine(raw: unknown, index: number): ScoreCheckLine {
  if (!isRecord(raw)) {
    throw new ScoreParseError(`checks[${index}] is not an object`);
  }
  const line: ScoreCheckLine = {
    id: requireString(raw, "id"),
    title: requireString(raw, "title"),
    skillNode: requireString(raw, "skillNode"),
    points: requireNumber(raw, "points"),
    earned: requireNumber(raw, "earned"),
    pass: requireBoolean(raw, "pass"),
    detail: requireString(raw, "detail"),
    timestamp: requireString(raw, "timestamp"),
  };
  if (typeof raw.error === "string" && raw.error.length > 0) {
    line.error = raw.error;
  }
  return line;
}

/** Parses + validates the raw JSON text rzagent printed to stdout (`--json`)
 * into a ScoreReport. Throws ScoreParseError on anything that doesn't match
 * agent/internal/report.Report's shape — a malformed report is a broker-side
 * bug or a broken agent build, never something to silently paper over. */
export function shapeReport(rawText: string): ScoreReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new ScoreParseError(`invalid JSON (${(err as Error).message})`);
  }
  if (!isRecord(parsed)) {
    throw new ScoreParseError("top-level value is not an object");
  }
  if (!Array.isArray(parsed.checks)) {
    throw new ScoreParseError('expected "checks" to be an array');
  }
  return {
    generatedAt: requireString(parsed, "generatedAt"),
    totalPossible: requireNumber(parsed, "totalPossible"),
    totalEarned: requireNumber(parsed, "totalEarned"),
    checks: parsed.checks.map(shapeCheckLine),
  };
}
