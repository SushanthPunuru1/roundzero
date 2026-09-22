import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Every user-facing word on this platform is American English.
 *
 * This exists because the landing page shipped "You can't practise the round"
 * two sentences after "Most practice hands you a score", and it took a human
 * reading the live site to catch it. A sweep afterwards found 26 more in the
 * lessons, drill cards and question banks. None of it was caught by `tsc`,
 * ESLint, the content parsers or any existing test, because none of them have
 * an opinion about spelling — so the next one would have shipped too.
 *
 * Not a general spellchecker: that needs a dictionary dependency (golden rule
 * 4 and 7) and drowns in `sshd`, `pwquality` and `auditpol` regardless. This
 * checks one specific, mechanical, high-frequency mistake, with zero
 * dependencies.
 *
 * Why it reaches into `apps/web` from `packages/db`: the mistake that started
 * this was on the marketing page, and a check that would not have caught the
 * bug it was written for is theatre. `packages/db` already owns every other
 * content-validation rule, so the alternative is a second test harness in a
 * package that has none.
 */

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

const SCAN_DIRS = [
  "packages/content",
  "apps/web/src",
  "packages/ui/src",
  "packages/db/src",
];
const SCAN_EXTS = new Set([".mdx", ".yaml", ".yml", ".tsx", ".ts"]);

/** British spellings that have an unambiguous American form. Deliberately
 * excludes words where both spellings are standard American English —
 * `grey`/`gray` and `cancelled`/`canceled` are fine either way, and failing a
 * build over them would be noise. */
const BRITISH = [
  "practis(e|es|ing|ed)",
  "(recognis|authoris|normalis|generalis|memoris|randomis|organis|summaris|minimis|maximis|prioritis|customis|utilis|optimis|specialis|initialis|apologis)(e|es|ing|ed|able|ation)",
  "realis(e|es|ing|ed)",
  "analys(e|es|ing|ed)",
  "(behaviour|colour|favour|flavour|honour|neighbour|labour|rumour|endeavour)s?",
  "(favourite|coloured|honoured|favoured)s?",
  "label(led|ling)",
  "travel(led|ling)",
  "model(ling)",
  "cancel(ling)",
  "defence",
  "offence",
  "licence",
  "centre(s|d)?",
  "centring",
  "catalogue",
  "artefacts?",
  "sceptic(al|ism)?",
  "whilst",
  "amongst",
  "learnt",
  "programme",
  "storey",
  "aluminium",
];

/**
 * Identifiers are exempt; prose is not.
 *
 * The distinction is whether the adjacent separator is glued to a word
 * character on its far side. `card.forensics.core.decoding.recognise` is an
 * ID — renaming it would orphan every learner's FSRS scheduling state for
 * that card, so it stays. `aria-labelledby` is the real HTML attribute name.
 * But `memorisation."` ends a sentence, and an earlier version of this guard
 * treated that trailing period as an identifier separator and silently
 * skipped three genuine mistakes. A guard that is too eager is how a check
 * passes while the bug is still there.
 */
function isIdentifier(line: string, start: number, end: number): boolean {
  const before = line[start - 1];
  if (before && ".-_".includes(before)) {
    const twoBefore = line[start - 2];
    if (twoBefore === undefined || /[A-Za-z0-9]/.test(twoBefore)) return true;
  }
  const after = line[end];
  if (after && ".-_".includes(after) && /[A-Za-z0-9]/.test(line[end + 1] ?? "")) {
    return true;
  }
  return false;
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) {
      continue;
    }
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (SCAN_EXTS.has(path.extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

describe("prose style", () => {
  it("uses American spellings in every user-facing string", () => {
    const pattern = new RegExp(`\\b(${BRITISH.join("|")})\\b`, "gi");
    const found: string[] = [];

    for (const dir of SCAN_DIRS) {
      for (const file of walk(path.join(ROOT, dir))) {
        // This file lists the words on purpose.
        if (file.endsWith("prose-style.test.ts")) continue;
        const rel = path.relative(ROOT, file).replace(/\\/g, "/");
        const lines = readFileSync(file, "utf8").split("\n");
        lines.forEach((line, i) => {
          for (const match of line.matchAll(pattern)) {
            const start = match.index ?? 0;
            if (isIdentifier(line, start, start + match[0].length)) continue;
            found.push(`${rel}:${i + 1}  "${match[0]}"`);
          }
        });
      }
    }

    expect(found, `British spellings found:\n${found.join("\n")}`).toEqual([]);
  });
});
