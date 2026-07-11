// Pure diff of desired (YAML) taxonomy nodes against existing (DB) rows.
// IDs are never destroyed (DECISIONS 006): a row missing from the YAML is
// marked deprecated, never deleted; a deprecated row that reappears is
// un-deprecated.

import type { DesiredNode } from "./parse";

export interface ExistingNode extends DesiredNode {
  deprecated: boolean;
}

export interface SyncPlan {
  toCreate: DesiredNode[];
  toUpdate: ExistingNode[];
  toDeprecate: ExistingNode[];
  unchanged: ExistingNode[];
}

function sameNode(desired: DesiredNode, existing: ExistingNode): boolean {
  return (
    desired.parentId === existing.parentId &&
    desired.title === existing.title &&
    desired.kind === existing.kind &&
    desired.level === existing.level &&
    desired.sortOrder === existing.sortOrder &&
    existing.deprecated === false
  );
}

export function reconcile(desired: DesiredNode[], existing: ExistingNode[]): SyncPlan {
  const existingById = new Map(existing.map((node) => [node.id, node]));
  const desiredIds = new Set(desired.map((node) => node.id));

  const toCreate: DesiredNode[] = [];
  const toUpdate: ExistingNode[] = [];
  const unchanged: ExistingNode[] = [];

  for (const node of desired) {
    const current = existingById.get(node.id);
    if (!current) {
      toCreate.push(node);
      continue;
    }
    if (sameNode(node, current)) {
      unchanged.push(current);
    } else {
      toUpdate.push({ ...node, deprecated: false });
    }
  }

  const toDeprecate: ExistingNode[] = [];
  for (const node of existing) {
    if (desiredIds.has(node.id)) continue;
    if (node.deprecated) {
      unchanged.push(node);
    } else {
      toDeprecate.push(node);
    }
  }

  return { toCreate, toUpdate, toDeprecate, unchanged };
}
