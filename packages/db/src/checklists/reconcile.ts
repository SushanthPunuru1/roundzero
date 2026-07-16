// Pure diff of desired (YAML) checklist templates/items against existing
// (DB) rows. Templates never disappear (there are exactly two canonical
// checklists) so only create/update/unchanged apply to them. Items can be
// removed from the YAML — canonical items carry no user data yet (team
// forks are separate TeamChecklistItem rows), so a removed item is deleted
// outright rather than soft-hidden. See DECISIONS 022.
//
// Note: Postgres jsonb does not preserve object key order, so "commands"
// must be compared by key/value pairs, never by JSON.stringify identity.

import type { DesiredChecklistItem, DesiredChecklistTemplate, OS } from "./parse";

export interface ExistingChecklistTemplate {
  id: string;
  os: OS;
  seasonId: string;
  version: number;
  title: string;
}

export interface ExistingChecklistItem {
  id: string;
  templateId: string;
  skillNodeId: string;
  sortOrder: number;
  action: string;
  why: string;
  commands: Record<string, string>;
  lessonSlug: string | null;
  caution: string | null;
}

export interface TemplateSyncPlan {
  toCreate: DesiredChecklistTemplate[];
  toUpdate: DesiredChecklistTemplate[];
  unchanged: DesiredChecklistTemplate[];
}

export interface ItemSyncPlan {
  toCreate: DesiredChecklistItem[];
  toUpdate: DesiredChecklistItem[];
  toRemove: ExistingChecklistItem[];
  unchanged: DesiredChecklistItem[];
}

export interface ChecklistSyncPlan {
  templates: TemplateSyncPlan;
  items: ItemSyncPlan;
}

function sameTemplate(desired: DesiredChecklistTemplate, existing: ExistingChecklistTemplate): boolean {
  return (
    desired.os === existing.os &&
    desired.seasonId === existing.seasonId &&
    desired.version === existing.version &&
    desired.title === existing.title
  );
}

function sameCommands(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key, index) => key === bKeys[index] && a[key] === b[key]);
}

function sameItem(desired: DesiredChecklistItem, existing: ExistingChecklistItem): boolean {
  return (
    desired.templateId === existing.templateId &&
    desired.skillNodeId === existing.skillNodeId &&
    desired.sortOrder === existing.sortOrder &&
    desired.action === existing.action &&
    desired.why === existing.why &&
    desired.lessonSlug === existing.lessonSlug &&
    desired.caution === existing.caution &&
    sameCommands(desired.commands, existing.commands)
  );
}

function reconcileTemplates(
  desired: DesiredChecklistTemplate[],
  existing: ExistingChecklistTemplate[],
): TemplateSyncPlan {
  const existingById = new Map(existing.map((template) => [template.id, template]));

  const toCreate: DesiredChecklistTemplate[] = [];
  const toUpdate: DesiredChecklistTemplate[] = [];
  const unchanged: DesiredChecklistTemplate[] = [];

  for (const template of desired) {
    const current = existingById.get(template.id);
    if (!current) {
      toCreate.push(template);
    } else if (sameTemplate(template, current)) {
      unchanged.push(template);
    } else {
      toUpdate.push(template);
    }
  }

  return { toCreate, toUpdate, unchanged };
}

function reconcileItems(
  desired: DesiredChecklistItem[],
  existing: ExistingChecklistItem[],
): ItemSyncPlan {
  const existingById = new Map(existing.map((item) => [item.id, item]));
  const desiredIds = new Set(desired.map((item) => item.id));

  const toCreate: DesiredChecklistItem[] = [];
  const toUpdate: DesiredChecklistItem[] = [];
  const unchanged: DesiredChecklistItem[] = [];

  for (const item of desired) {
    const current = existingById.get(item.id);
    if (!current) {
      toCreate.push(item);
    } else if (sameItem(item, current)) {
      unchanged.push(item);
    } else {
      toUpdate.push(item);
    }
  }

  const toRemove = existing.filter((item) => !desiredIds.has(item.id));

  return { toCreate, toUpdate, toRemove, unchanged };
}

export function reconcileChecklists(
  desired: DesiredChecklistTemplate[],
  existingTemplates: ExistingChecklistTemplate[],
  existingItems: ExistingChecklistItem[],
): ChecklistSyncPlan {
  const desiredItems = desired.flatMap((template) => template.items);
  return {
    templates: reconcileTemplates(desired, existingTemplates),
    items: reconcileItems(desiredItems, existingItems),
  };
}
