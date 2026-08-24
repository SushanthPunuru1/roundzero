// Pure parse + validate for packages/content/cards/core.yaml.
// No DB access here — see prisma/seed.ts for the apply step. DECISIONS 006/007.

import { parse as parseYaml } from "yaml";
import { ID_PATTERN } from "../taxonomy/parse";
import type { KnownNode } from "../lessons/parse";

export type CardType = "CONCEPT" | "COMMAND";

export interface DesiredCard {
  id: string;
  skillNodeId: string;
  type: CardType;
  front: string;
  back: string;
}

export class CardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CardError";
  }
}

const CARD_TYPE_VALUES: CardType[] = ["CONCEPT", "COMMAND"];

interface RawCard {
  id?: unknown;
  skillNodeId?: unknown;
  type?: unknown;
  front?: unknown;
  back?: unknown;
}

interface RawFile {
  version?: unknown;
  cards?: unknown;
}

function assertId(id: unknown, field: string, where: string): string {
  if (typeof id !== "string" || id.length === 0) {
    throw new CardError(`${where}: missing or non-string "${field}"`);
  }
  if (!ID_PATTERN.test(id)) {
    throw new CardError(
      `${where}: "${field}" "${id}" is not a well-formed dotted lowercase id`,
    );
  }
  return id;
}

function assertNonEmptyString(value: unknown, field: string, where: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CardError(`${where}: missing or non-string "${field}"`);
  }
  return value;
}

function parseCard(raw: RawCard, index: number): DesiredCard {
  const where = `cards[${index}]`;
  const id = assertId(raw.id, "id", where);
  const skillNodeId = assertId(raw.skillNodeId, "skillNodeId", where);

  if (typeof raw.type !== "string" || !CARD_TYPE_VALUES.includes(raw.type as CardType)) {
    throw new CardError(
      `${where} ("${id}"): "type" must be one of ${CARD_TYPE_VALUES.join(", ")}`,
    );
  }

  const front = assertNonEmptyString(raw.front, "front", `${where} ("${id}")`);
  const back = assertNonEmptyString(raw.back, "back", `${where} ("${id}")`);

  return { id, skillNodeId, type: raw.type as CardType, front, back };
}

/**
 * Parses and fully validates packages/content/cards/core.yaml. Throws
 * CardError with a precise message on any structural problem — never returns
 * partial data. Does not check skillNodeId against the taxonomy — see
 * validateCardRefs.
 */
export function parseCards(text: string): DesiredCard[] {
  const data = parseYaml(text) as RawFile | null;
  if (data === null || typeof data !== "object") {
    throw new CardError("cards YAML: empty or not a YAML mapping");
  }
  if (!Array.isArray(data.cards) || data.cards.length === 0) {
    throw new CardError('cards YAML: missing top-level "cards" array');
  }

  const seenIds = new Set<string>();
  return data.cards.map((rawCard, index) => {
    const card = parseCard(rawCard as RawCard, index);
    if (seenIds.has(card.id)) {
      throw new CardError(`duplicate card id "${card.id}"`);
    }
    seenIds.add(card.id);
    return card;
  });
}

/**
 * Validates every skillNodeId reference against the taxonomy spine. Fails
 * loudly (throws CardError) if any id is unknown or not a leaf skill node —
 * the spine must hold for drill cards too. Pure: takes the known-node set as
 * a parameter.
 */
export function validateCardRefs(cards: DesiredCard[], knownNodes: KnownNode[]): void {
  const byId = new Map(knownNodes.map((node) => [node.id, node]));
  for (const card of cards) {
    const skill = byId.get(card.skillNodeId);
    if (!skill) {
      throw new CardError(`card "${card.id}": unknown skill node id "${card.skillNodeId}"`);
    }
    if (skill.kind !== "SKILL") {
      throw new CardError(
        `card "${card.id}": "${card.skillNodeId}" is not a taxonomy skill (leaf) node`,
      );
    }
  }
}

/** The minimum cards a leaf skill node must carry. Below this, finishing the
 * lesson that teaches the node enqueues a drill session too short to be worth
 * scheduling — see findCoverageGaps. */
export const MIN_CARDS_PER_NODE = 3;

export interface CoverageGap {
  skillNodeId: string;
  cardCount: number;
}

/**
 * Reports leaf skill nodes carrying fewer than `minCards` drill cards, in
 * taxonomy order. This is a soft invariant, deliberately returned rather than
 * thrown: a node added to the taxonomy ahead of its cards is a normal state
 * mid-authoring, and blocking `db:seed` on it would make the spine harder to
 * extend, not easier. The seed reports gaps; nothing fails on them.
 *
 * It matters because `enqueueLessonCards` resolves cards through the lesson's
 * skill nodes — a node with no cards means completing its lesson silently
 * enqueues nothing, and the SRS looks broken rather than empty. Pure: takes
 * the known-node set as a parameter.
 */
export function findCoverageGaps(
  cards: DesiredCard[],
  knownNodes: KnownNode[],
  minCards: number = MIN_CARDS_PER_NODE,
): CoverageGap[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    counts.set(card.skillNodeId, (counts.get(card.skillNodeId) ?? 0) + 1);
  }

  const gaps: CoverageGap[] = [];
  for (const node of knownNodes) {
    if (node.kind !== "SKILL") continue;
    const cardCount = counts.get(node.id) ?? 0;
    if (cardCount < minCards) gaps.push({ skillNodeId: node.id, cardCount });
  }
  return gaps;
}
