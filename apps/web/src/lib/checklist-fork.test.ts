import { describe, expect, it } from "vitest";

import {
  NO_TEAM_NAME,
  NO_TEAM_SLUG,
  commandsOverrideOrNull,
  formatRecordId,
  originLabel,
  overrideOrNull,
  parseCommandsDraft,
  sameCommandsMap,
  snapshotFor,
  toForkItemRow,
  toUpstreamItem,
  versionLabel,
} from "./checklist-fork";

describe("overrideOrNull", () => {
  it("returns null when the value equals upstream (trimmed)", () => {
    expect(overrideOrNull("Read the README first.", "Read the README first.")).toBeNull();
    expect(overrideOrNull("  Read the README first.  ", "Read the README first.")).toBeNull();
  });

  it("returns the trimmed value when it differs from upstream", () => {
    expect(overrideOrNull("  Read the README and the scoring report.  ", "Read the README first.")).toBe(
      "Read the README and the scoring report.",
    );
  });
});

describe("commandsOverrideOrNull", () => {
  it("returns null when the map equals upstream regardless of key order", () => {
    expect(
      commandsOverrideOrNull(
        { ubuntu24: "b", all: "a" },
        { all: "a", ubuntu24: "b" },
      ),
    ).toBeNull();
  });

  it("returns the full map when any variant differs", () => {
    const edited = { all: "a", ubuntu24: "b-edited" };
    expect(commandsOverrideOrNull(edited, { all: "a", ubuntu24: "b" })).toBe(edited);
  });

  it("returns the full map (not a partial one) when only one variant was touched", () => {
    // The caller is responsible for merging unedited variants in before
    // calling this — this just asserts the whole map round-trips untouched.
    const edited = { all: "a-edited", ubuntu22: "c", ubuntu24: "b" };
    expect(commandsOverrideOrNull(edited, { all: "a", ubuntu22: "c", ubuntu24: "b" })).toEqual(edited);
  });
});

describe("sameCommandsMap", () => {
  it("treats equal maps as equal regardless of key order", () => {
    expect(sameCommandsMap({ ubuntu24: "b", all: "a" }, { all: "a", ubuntu24: "b" })).toBe(true);
  });

  it("is false when a value differs", () => {
    expect(sameCommandsMap({ all: "a" }, { all: "a-different" })).toBe(false);
  });

  it("is false when key sets differ", () => {
    expect(sameCommandsMap({ all: "a" }, { all: "a", ubuntu24: "b" })).toBe(false);
  });

  it("is true for two separately-created equal objects (not a reference check)", () => {
    const a = { all: "sudo apt update" };
    const b = { all: "sudo apt update" };
    expect(a).not.toBe(b);
    expect(sameCommandsMap(a, b)).toBe(true);
  });
});

describe("parseCommandsDraft", () => {
  it("builds a map from key/value pairs", () => {
    expect(
      parseCommandsDraft([
        { key: "all", value: "sudo apt update" },
        { key: "ubuntu24", value: "sudo apt upgrade" },
      ]),
    ).toEqual({ all: "sudo apt update", ubuntu24: "sudo apt upgrade" });
  });

  it("drops entries with a blank key", () => {
    expect(
      parseCommandsDraft([
        { key: "all", value: "x" },
        { key: "  ", value: "dropped" },
      ]),
    ).toEqual({ all: "x" });
  });

  it("trims keys and values", () => {
    expect(parseCommandsDraft([{ key: " all ", value: " sudo apt update " }])).toEqual({
      all: "sudo apt update",
    });
  });

  it("returns an empty map for no entries", () => {
    expect(parseCommandsDraft([])).toEqual({});
  });
});

describe("originLabel", () => {
  it("labels every origin", () => {
    expect(originLabel("upstream")).toBe("Inherited");
    expect(originLabel("edited")).toBe("Edited");
    expect(originLabel("team-added")).toBe("Team-added");
  });
});

describe("formatRecordId", () => {
  it("builds a stable, sortable record id", () => {
    expect(
      formatRecordId({
        templateId: "linux-core",
        version: 2,
        teamSlug: "wildcats-ab12cd",
        date: new Date("2026-08-12T00:00:00.000Z"),
      }),
    ).toBe("RZ-LINUX-CORE-V2-WILDCATS-AB12CD-20260812");
  });

  it("uses the no-team fallback slug for an unaffiliated viewer", () => {
    expect(
      formatRecordId({
        templateId: "linux-core",
        version: 1,
        teamSlug: NO_TEAM_SLUG,
        date: new Date("2026-08-12T00:00:00.000Z"),
      }),
    ).toBe("RZ-LINUX-CORE-V1-NO-TEAM-20260812");
  });
});

describe("NO_TEAM_NAME", () => {
  it("is a real label, never blank", () => {
    expect(NO_TEAM_NAME.length).toBeGreaterThan(0);
  });
});

describe("toUpstreamItem", () => {
  it("maps a Prisma ChecklistItem row's Json commands to a typed record", () => {
    expect(
      toUpstreamItem({
        id: "linux.setup.readme",
        skillNodeId: "foundations.competition.readme",
        sortOrder: 10,
        action: "Read the README first.",
        why: "Fixing a vuln can destroy evidence.",
        commands: { all: "# read the README" },
        lessonSlug: "reading-a-readme",
        caution: null,
      }),
    ).toEqual({
      id: "linux.setup.readme",
      skillNodeId: "foundations.competition.readme",
      sortOrder: 10,
      action: "Read the README first.",
      why: "Fixing a vuln can destroy evidence.",
      commands: { all: "# read the README" },
      lessonSlug: "reading-a-readme",
      caution: null,
    });
  });
});

describe("toForkItemRow", () => {
  it("maps a Prisma TeamChecklistItem row, defaulting a Json null to a plain null", () => {
    expect(
      toForkItemRow({
        id: "row1",
        upstreamItemId: "linux.setup.readme",
        sortOrder: 0,
        action: null,
        why: null,
        commands: null,
        removed: false,
        actionSnapshot: null,
        whySnapshot: null,
        commandsSnapshot: null,
      }),
    ).toEqual({
      id: "row1",
      upstreamItemId: "linux.setup.readme",
      sortOrder: 0,
      action: null,
      why: null,
      commands: null,
      removed: false,
      actionSnapshot: null,
      whySnapshot: null,
      commandsSnapshot: null,
    });
  });

  it("passes through a team-added row's own text", () => {
    expect(
      toForkItemRow({
        id: "row2",
        upstreamItemId: null,
        sortOrder: 5,
        action: "Check the club's custom banner.",
        why: "Our README always asks for it.",
        commands: { all: "cat /etc/issue.net" },
        removed: false,
        actionSnapshot: null,
        whySnapshot: null,
        commandsSnapshot: null,
      }),
    ).toEqual({
      id: "row2",
      upstreamItemId: null,
      sortOrder: 5,
      action: "Check the club's custom banner.",
      why: "Our README always asks for it.",
      commands: { all: "cat /etc/issue.net" },
      removed: false,
      actionSnapshot: null,
      whySnapshot: null,
      commandsSnapshot: null,
    });
  });

  it("passes through a recorded snapshot, defaulting a Json null commandsSnapshot to plain null", () => {
    expect(
      toForkItemRow({
        id: "row3",
        upstreamItemId: "linux.setup.readme",
        sortOrder: 0,
        action: "Our wording",
        why: null,
        commands: null,
        removed: false,
        actionSnapshot: "Upstream's wording at override time",
        whySnapshot: null,
        commandsSnapshot: null,
      }),
    ).toEqual(
      expect.objectContaining({
        actionSnapshot: "Upstream's wording at override time",
        whySnapshot: null,
        commandsSnapshot: null,
      }),
    );
  });
});

describe("snapshotFor", () => {
  it("is null when the override is null — nothing to remember", () => {
    expect(snapshotFor(null, "current upstream value")).toBeNull();
  });

  it("is the current upstream value when there's a real override", () => {
    expect(snapshotFor("team's wording", "current upstream value")).toBe("current upstream value");
  });
});

describe("versionLabel", () => {
  it("shows just the current version when there is no fork", () => {
    expect(versionLabel(2, null)).toBe("v2");
  });

  it("shows just the current version when the fork is up to date", () => {
    expect(versionLabel(2, 2)).toBe("v2");
  });

  it("surfaces both versions when the template has moved on since the fork", () => {
    expect(versionLabel(2, 1)).toBe("v2 · forked at v1");
  });
});
