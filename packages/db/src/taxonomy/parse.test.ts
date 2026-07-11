import { describe, expect, it } from "vitest";
import { parseTaxonomy, TaxonomyError } from "./parse";

const VALID_YAML = `
version: 1
domains:
  - id: foundations
    title: Foundations
    categories:
      - id: foundations.core
        title: Core concepts
        skills:
          - { id: foundations.core.os-basics, title: "What an OS is", level: foundations }
          - { id: foundations.core.ports, title: "What a port is", level: foundations }
  - id: linux
    title: Linux
    categories:
      - id: linux.pam
        title: PAM
        skills:
          - { id: linux.pam.pwquality, title: "pam_pwquality", level: standard }
`;

describe("parseTaxonomy", () => {
  it("flattens domains/categories/skills into DesiredNode rows", () => {
    const nodes = parseTaxonomy(VALID_YAML);

    expect(nodes).toEqual([
      { id: "foundations", parentId: null, title: "Foundations", kind: "DOMAIN", level: null, sortOrder: 0 },
      {
        id: "foundations.core",
        parentId: "foundations",
        title: "Core concepts",
        kind: "CATEGORY",
        level: null,
        sortOrder: 0,
      },
      {
        id: "foundations.core.os-basics",
        parentId: "foundations.core",
        title: "What an OS is",
        kind: "SKILL",
        level: "FOUNDATIONS",
        sortOrder: 0,
      },
      {
        id: "foundations.core.ports",
        parentId: "foundations.core",
        title: "What a port is",
        kind: "SKILL",
        level: "FOUNDATIONS",
        sortOrder: 1,
      },
      { id: "linux", parentId: null, title: "Linux", kind: "DOMAIN", level: null, sortOrder: 1 },
      { id: "linux.pam", parentId: "linux", title: "PAM", kind: "CATEGORY", level: null, sortOrder: 0 },
      {
        id: "linux.pam.pwquality",
        parentId: "linux.pam",
        title: "pam_pwquality",
        kind: "SKILL",
        level: "STANDARD",
        sortOrder: 0,
      },
    ]);
  });

  it("rejects duplicate ids anywhere in the file", () => {
    const yamlText = `
version: 1
domains:
  - id: foundations
    title: Foundations
    categories:
      - id: foundations.core
        title: Core concepts
        skills:
          - { id: foundations.core.os-basics, title: "A", level: foundations }
      - id: foundations.core
        title: Duplicate category
        skills: []
`;
    expect(() => parseTaxonomy(yamlText)).toThrow(TaxonomyError);
    expect(() => parseTaxonomy(yamlText)).toThrow(/duplicate id "foundations.core"/);
  });

  it("rejects malformed dotted ids", () => {
    const yamlText = `
version: 1
domains:
  - id: Foundations!
    title: Foundations
    categories: []
`;
    expect(() => parseTaxonomy(yamlText)).toThrow(/not a well-formed dotted lowercase id/);
  });

  it("rejects a skill with a missing or invalid level", () => {
    const yamlText = `
version: 1
domains:
  - id: foundations
    title: Foundations
    categories:
      - id: foundations.core
        title: Core concepts
        skills:
          - { id: foundations.core.os-basics, title: "A" }
`;
    expect(() => parseTaxonomy(yamlText)).toThrow(/"level" must be one of/);
  });

  it("rejects a domain that carries a level", () => {
    const yamlText = `
version: 1
domains:
  - id: foundations
    title: Foundations
    level: foundations
    categories: []
`;
    expect(() => parseTaxonomy(yamlText)).toThrow(/domains must not set "level"/);
  });

  it("rejects a category id not prefixed by its parent domain id", () => {
    const yamlText = `
version: 1
domains:
  - id: foundations
    title: Foundations
    categories:
      - id: linux.core
        title: Wrong prefix
        skills: []
`;
    expect(() => parseTaxonomy(yamlText)).toThrow(/must be prefixed with its parent domain id/);
  });

  it("rejects a skill id not prefixed by its parent category id", () => {
    const yamlText = `
version: 1
domains:
  - id: foundations
    title: Foundations
    categories:
      - id: foundations.core
        title: Core concepts
        skills:
          - { id: foundations.other.os-basics, title: "A", level: foundations }
`;
    expect(() => parseTaxonomy(yamlText)).toThrow(/must be prefixed with its parent category id/);
  });

  it("rejects a file missing top-level domains", () => {
    expect(() => parseTaxonomy("version: 1")).toThrow(/missing top-level "domains"/);
  });
});
