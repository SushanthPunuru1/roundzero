import { describe, expect, it } from "vitest";
import { CardError, parseCards, validateCardRefs } from "./parse";
import type { KnownNode } from "../lessons/parse";

const VALID_YAML = `
version: 1
cards:
  - id: card.foundations.competition.readme.four-lists
    skillNodeId: foundations.competition.readme
    type: CONCEPT
    front: "What four lists do you extract from the README?"
    back: "Admins, users, required services, do's and do-not's."

  - id: card.linux.accounts.uid0.cmd
    skillNodeId: linux.accounts.uid0
    type: COMMAND
    front: "Linux: find every UID 0 account."
    back: "awk -F: '$3 == 0 { print $1 }' /etc/passwd"
`;

describe("parseCards", () => {
  it("parses a valid file into DesiredCard rows", () => {
    const cards = parseCards(VALID_YAML);

    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({
      id: "card.foundations.competition.readme.four-lists",
      skillNodeId: "foundations.competition.readme",
      type: "CONCEPT",
      front: "What four lists do you extract from the README?",
      back: "Admins, users, required services, do's and do-not's.",
    });
    expect(cards[1]).toEqual({
      id: "card.linux.accounts.uid0.cmd",
      skillNodeId: "linux.accounts.uid0",
      type: "COMMAND",
      front: "Linux: find every UID 0 account.",
      back: "awk -F: '$3 == 0 { print $1 }' /etc/passwd",
    });
  });

  it("rejects an empty/non-mapping file", () => {
    expect(() => parseCards("")).toThrow(CardError);
    expect(() => parseCards("")).toThrow(/empty or not a YAML mapping/);
  });

  it("rejects a missing top-level cards array", () => {
    expect(() => parseCards("version: 1")).toThrow(/missing top-level "cards" array/);
  });

  it("rejects an empty cards array", () => {
    expect(() => parseCards("version: 1\ncards: []")).toThrow(/missing top-level "cards" array/);
  });

  it("rejects a malformed card id", () => {
    const yamlText = VALID_YAML.replace(
      "id: card.foundations.competition.readme.four-lists",
      "id: Card.Not.Valid!",
    );
    expect(() => parseCards(yamlText)).toThrow(/not a well-formed dotted lowercase id/);
  });

  it("rejects a malformed skillNodeId", () => {
    const yamlText = VALID_YAML.replace(
      "skillNodeId: foundations.competition.readme",
      "skillNodeId: Not Valid!",
    );
    expect(() => parseCards(yamlText)).toThrow(/not a well-formed dotted lowercase id/);
  });

  it("rejects an invalid type", () => {
    const yamlText = VALID_YAML.replace("type: CONCEPT", "type: TRIVIA");
    expect(() => parseCards(yamlText)).toThrow(/"type" must be one of CONCEPT, COMMAND/);
  });

  it("rejects a missing front", () => {
    const yamlText = VALID_YAML.replace(
      'front: "What four lists do you extract from the README?"',
      "",
    );
    expect(() => parseCards(yamlText)).toThrow(/missing or non-string "front"/);
  });

  it("rejects a missing back", () => {
    const yamlText = VALID_YAML.replace(
      "back: \"Admins, users, required services, do's and do-not's.\"",
      "",
    );
    expect(() => parseCards(yamlText)).toThrow(/missing or non-string "back"/);
  });

  it("rejects a duplicate card id", () => {
    const yamlText = VALID_YAML.replace(
      "id: card.linux.accounts.uid0.cmd",
      "id: card.foundations.competition.readme.four-lists",
    );
    expect(() => parseCards(yamlText)).toThrow(
      /duplicate card id "card.foundations.competition.readme.four-lists"/,
    );
  });
});

describe("validateCardRefs", () => {
  const knownNodes: KnownNode[] = [
    { id: "foundations.competition.readme", kind: "SKILL" },
    { id: "linux.accounts.uid0", kind: "SKILL" },
    { id: "linux.accounts", kind: "CATEGORY" },
  ];

  it("accepts cards whose refs all resolve to leaf skills", () => {
    expect(() => validateCardRefs(parseCards(VALID_YAML), knownNodes)).not.toThrow();
  });

  it("rejects an unknown skill node id", () => {
    const cards = parseCards(VALID_YAML);
    cards[1]!.skillNodeId = "linux.accounts.nonexistent";
    expect(() => validateCardRefs(cards, knownNodes)).toThrow(
      /unknown skill node id "linux.accounts.nonexistent"/,
    );
  });

  it("rejects a skillNodeId that resolves to a non-leaf node", () => {
    const cards = parseCards(VALID_YAML);
    cards[1]!.skillNodeId = "linux.accounts";
    expect(() => validateCardRefs(cards, knownNodes)).toThrow(
      /is not a taxonomy skill \(leaf\) node/,
    );
  });
});
