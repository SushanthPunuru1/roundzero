// Pure checklist-detail domain logic — no DB/framework imports, fully
// unit-testable. The detail page (apps/app/checklists/[id]/page.tsx) queries
// Prisma and layers this section-grouping/formatting on top.

import type { OS } from "@roundzero/db";

export interface ChecklistItemView {
  id: string;
  skillNodeId: string;
  sortOrder: number;
  action: string;
  why: string;
  commands: Record<string, string>;
  lessonSlug: string | null;
  caution: string | null;
  categoryId: string;
  categoryTitle: string;
}

export interface ChecklistSection {
  categoryId: string;
  /** null = headerless: a single-item run on its first occurrence, where
   * the item's own category chip already carries identity. */
  headerTitle: string | null;
  /** null iff headerTitle is null — no jump target for a headerless run. */
  anchor: string | null;
  items: ChecklistItemView[];
}

export function osLabel(os: OS): string {
  return os === "LINUX" ? "Linux" : "Windows";
}

const COMMAND_LABELS: Record<string, string> = {
  all: "All versions",
  ubuntu22: "Ubuntu 22.04",
  ubuntu24: "Ubuntu 24.04",
};

export function commandLabel(key: string): string {
  return COMMAND_LABELS[key] ?? key;
}

/** Stable command order regardless of source key order (Postgres jsonb does
 * not preserve object key order): "all" first, then the rest alphabetically. */
export function commandEntries(commands: Record<string, string>): [string, string][] {
  const keys = Object.keys(commands);
  const rest = keys.filter((key) => key !== "all").sort();
  const ordered = keys.includes("all") ? ["all", ...rest] : rest;
  return ordered.map((key) => [key, commands[key]!]);
}

function toAnchorBase(categoryId: string): string {
  return categoryId.replace(/\./g, "-");
}

/**
 * Groups items (already in authored sortOrder — never reorder) into
 * contiguous category runs for the detail page. A run starts whenever the
 * category changes from the previous item. The first time a category is
 * seen it gets a plain header; if it recurs later in a separate run, that
 * run's header reads "{category} — continued". A single-item run on its
 * first occurrence renders without a header at all (the item's own category
 * chip already carries identity) and is skipped by the TOC; a single-item
 * *recurrence* still gets the "— continued" header, since that signal is
 * the useful one.
 */
export function groupItemsIntoSections(items: ChecklistItemView[]): ChecklistSection[] {
  interface Run {
    categoryId: string;
    categoryTitle: string;
    items: ChecklistItemView[];
  }

  const runs: Run[] = [];
  for (const item of items) {
    const last = runs.at(-1);
    if (last && last.categoryId === item.categoryId) {
      last.items.push(item);
    } else {
      runs.push({ categoryId: item.categoryId, categoryTitle: item.categoryTitle, items: [item] });
    }
  }

  const seenCategoryIds = new Set<string>();
  const anchorOccurrence = new Map<string, number>();

  return runs.map((run) => {
    const isRecurrence = seenCategoryIds.has(run.categoryId);
    seenCategoryIds.add(run.categoryId);

    const headerless = run.items.length === 1 && !isRecurrence;
    const headerTitle = headerless
      ? null
      : isRecurrence
        ? `${run.categoryTitle} — continued`
        : run.categoryTitle;

    let anchor: string | null = null;
    if (headerTitle !== null) {
      const occurrence = anchorOccurrence.get(run.categoryId) ?? 0;
      anchorOccurrence.set(run.categoryId, occurrence + 1);
      const base = toAnchorBase(run.categoryId);
      anchor = occurrence === 0 ? base : `${base}-${occurrence + 1}`;
    }

    return { categoryId: run.categoryId, headerTitle, anchor, items: run.items };
  });
}
