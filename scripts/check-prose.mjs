#!/usr/bin/env node
/**
 * Fast British-spelling check over STAGED files only, for use as a
 * pre-commit hook.
 *
 * Why this exists: `packages/db/src/content/prose-style.test.ts` already
 * catches these, and has caught five of them — every single one written by
 * an assistant editing a comment, several of them in comments about not
 * writing British spellings. The test works. The problem is that it only
 * runs as part of a ~60s suite, late, after the work feels finished, which
 * is the worst moment to be interrupted.
 *
 * So this is the same check moved forward: staged files only, no vitest, no
 * dependencies, runs in well under a second.
 *
 * THE VITEST TEST REMAINS AUTHORITATIVE. It scans the whole repo rather than
 * a diff, so it catches a bad word that arrives via a merge, a revert, or an
 * unstaged edit. This hook is an early warning, not a replacement, and the
 * word list below is deliberately a copy — if the two ever disagree, the
 * test is right.
 *
 * Install once:  git config core.hooksPath .githooks
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const SCAN_DIRS = [
  "packages/content",
  "packages/ui/src",
  "packages/db/src",
  "apps/web/src",
];
const SCAN_EXTS = new Set([".mdx", ".yaml", ".yml", ".tsx", ".ts", ".css"]);

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
];

/** Identifiers are exempt; prose is not. A separator only counts when it is
 * glued to a word character on its far side — so `aria-labelledby` and
 * `card.forensics.core.decoding.recognise` pass, while `colour.` at the end
 * of a sentence does not. Mirrors the test exactly. */
function isIdentifier(line, start, end) {
  const before = line[start - 1];
  if (before && ".-_".includes(before)) {
    const two = line[start - 2];
    if (two === undefined || /[A-Za-z0-9]/.test(two)) return true;
  }
  const after = line[end];
  return !!(after && ".-_".includes(after) && /[A-Za-z0-9]/.test(line[end + 1] ?? ""));
}

let staged = [];
try {
  staged = execSync("git diff --cached --name-only --diff-filter=ACM", {
    encoding: "utf8",
  })
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
} catch {
  process.exit(0); // not a git context; nothing to check
}

const targets = staged.filter(
  (f) =>
    SCAN_DIRS.some((d) => f.startsWith(d)) &&
    SCAN_EXTS.has(path.extname(f)) &&
    !f.endsWith("prose-style.test.ts") &&
    !f.endsWith("check-prose.mjs") &&
    existsSync(f),
);

const pattern = new RegExp(`\\b(${BRITISH.join("|")})\\b`, "gi");
const found = [];

for (const file of targets) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const m of line.matchAll(pattern)) {
        const s = m.index ?? 0;
        if (isIdentifier(line, s, s + m[0].length)) continue;
        found.push(`  ${file}:${i + 1}  "${m[0]}"`);
      }
    });
}

if (found.length) {
  console.error("\nBritish spellings in staged files:\n");
  console.error(found.join("\n"));
  console.error(
    "\nThis project ships to US high-school competitors; copy is American English.",
  );
  console.error("Fix them, or commit with --no-verify if you are sure.\n");
  process.exit(1);
}
