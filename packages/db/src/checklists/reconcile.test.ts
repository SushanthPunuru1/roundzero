import { describe, expect, it } from "vitest";
import { reconcileChecklists, type ExistingChecklistItem, type ExistingChecklistTemplate } from "./reconcile";
import type { DesiredChecklistTemplate } from "./parse";

function template(overrides: Partial<DesiredChecklistTemplate> = {}): DesiredChecklistTemplate {
  return {
    id: "linux-core",
    os: "LINUX",
    seasonId: "cp-19",
    version: 1,
    title: "Linux core hardening",
    items: [
      {
        id: "linux.pam.pwquality",
        templateId: "linux-core",
        skillNodeId: "linux.pam.pwquality",
        sortOrder: 10,
        action: "Enforce password quality.",
        why: "It's scored.",
        commands: { ubuntu22: "cmd22", ubuntu24: "cmd24" },
        lessonSlug: null,
        caution: null,
      },
    ],
    ...overrides,
  };
}

function existingTemplateFrom(t: DesiredChecklistTemplate): ExistingChecklistTemplate {
  return { id: t.id, os: t.os, seasonId: t.seasonId, version: t.version, title: t.title };
}

function existingItemsFrom(t: DesiredChecklistTemplate): ExistingChecklistItem[] {
  return t.items.map((item) => ({ ...item }));
}

describe("reconcileChecklists", () => {
  it("creates a template and its items when nothing exists yet", () => {
    const t = template();
    const plan = reconcileChecklists([t], [], []);

    expect(plan.templates.toCreate).toEqual([t]);
    expect(plan.templates.toUpdate).toEqual([]);
    expect(plan.templates.unchanged).toEqual([]);

    expect(plan.items.toCreate).toEqual(t.items);
    expect(plan.items.toUpdate).toEqual([]);
    expect(plan.items.toRemove).toEqual([]);
    expect(plan.items.unchanged).toEqual([]);
  });

  it("reports everything unchanged on a second identical run", () => {
    const t = template();
    const plan = reconcileChecklists([t], [existingTemplateFrom(t)], existingItemsFrom(t));

    expect(plan.templates.toCreate).toEqual([]);
    expect(plan.templates.toUpdate).toEqual([]);
    expect(plan.templates.unchanged).toEqual([t]);

    expect(plan.items.toCreate).toEqual([]);
    expect(plan.items.toUpdate).toEqual([]);
    expect(plan.items.toRemove).toEqual([]);
    expect(plan.items.unchanged).toEqual(t.items);
  });

  it("treats commands with reordered keys as unchanged (jsonb does not preserve key order)", () => {
    const t = template();
    const existingTemplate = existingTemplateFrom(t);
    const existingItems = t.items.map((item) => ({
      ...item,
      commands: { ubuntu24: item.commands.ubuntu24!, ubuntu22: item.commands.ubuntu22! },
    }));

    const plan = reconcileChecklists([t], [existingTemplate], existingItems);

    expect(plan.items.toUpdate).toEqual([]);
    expect(plan.items.unchanged).toEqual(t.items);
  });

  it("flags a template as changed when a field (e.g. version) differs", () => {
    const t = template();
    const existingTemplate = { ...existingTemplateFrom(t), version: 2 };

    const plan = reconcileChecklists([t], [existingTemplate], existingItemsFrom(t));

    expect(plan.templates.toUpdate).toEqual([t]);
    expect(plan.templates.unchanged).toEqual([]);
  });

  it("flags an item as changed when commands actually differ", () => {
    const t = template();
    const existingItems = t.items.map((item) => ({ ...item, commands: { ...item.commands, ubuntu22: "different" } }));

    const plan = reconcileChecklists([t], [existingTemplateFrom(t)], existingItems);

    expect(plan.items.toUpdate).toEqual(t.items);
    expect(plan.items.unchanged).toEqual([]);
  });

  it("flags an item as changed when caution is added", () => {
    const t = template();
    const existingItems = existingItemsFrom(t); // caution: null on existing

    const withCaution = template({
      items: [{ ...t.items[0]!, caution: "Back up first." }],
    });

    const plan = reconcileChecklists([withCaution], [existingTemplateFrom(t)], existingItems);

    expect(plan.items.toUpdate).toEqual(withCaution.items);
    expect(plan.items.unchanged).toEqual([]);
  });

  it("removes an item whose id is no longer present in the YAML", () => {
    const t = template();
    const goneItem: ExistingChecklistItem = {
      id: "linux.old.gone",
      templateId: "linux-core",
      skillNodeId: "linux.pam.pwquality",
      sortOrder: 5,
      action: "old",
      why: "old",
      commands: { all: "old" },
      lessonSlug: null,
      caution: null,
    };

    const plan = reconcileChecklists(
      [t],
      [existingTemplateFrom(t)],
      [...existingItemsFrom(t), goneItem],
    );

    expect(plan.items.toRemove).toEqual([goneItem]);
    expect(plan.items.unchanged).toEqual(t.items);
  });
});
