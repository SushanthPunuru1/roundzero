import { describe, expect, it } from "vitest";

import { LabLimitExceededError, LabNotFoundError, LabRegistry, type ContainerDriver } from "./registry";

class FakeDriver implements ContainerDriver {
  created: string[] = [];
  removed: string[] = [];
  private counter = 0;

  async create(containerName: string): Promise<{ containerId: string }> {
    this.created.push(containerName);
    this.counter += 1;
    return { containerId: `container-${this.counter}` };
  }

  async remove(containerId: string): Promise<void> {
    this.removed.push(containerId);
  }
}

class FakeClock {
  private msNow: number;
  constructor(startMs = 0) {
    this.msNow = startMs;
  }
  now = (): Date => new Date(this.msNow);
  advance(ms: number): void {
    this.msNow += ms;
  }
}

function makeRegistry(overrides: { maxLabs?: number; idleTimeoutMs?: number } = {}) {
  const driver = new FakeDriver();
  const clock = new FakeClock();
  let idCounter = 0;
  const registry = new LabRegistry({
    driver,
    maxLabs: overrides.maxLabs ?? 1,
    idleTimeoutMs: overrides.idleTimeoutMs ?? 1000,
    now: clock.now,
    generateId: () => `lab-${++idCounter}`,
  });
  return { registry, driver, clock };
}

describe("LabRegistry.create", () => {
  it("creates a lab via the driver and tracks it", async () => {
    const { registry, driver } = makeRegistry();
    const lab = await registry.create();
    expect(lab.id).toBe("lab-1");
    expect(lab.containerId).toBe("container-1");
    expect(driver.created).toEqual(["rz-lab-lab-1"]);
    expect(registry.list()).toHaveLength(1);
  });

  it("rejects a second lab once maxLabs is reached", async () => {
    const { registry } = makeRegistry({ maxLabs: 1 });
    await registry.create();
    await expect(registry.create()).rejects.toThrow(LabLimitExceededError);
  });

  it("allows a new lab after the first is deleted", async () => {
    const { registry } = makeRegistry({ maxLabs: 1 });
    const first = await registry.create();
    await registry.delete(first.id);
    await expect(registry.create()).resolves.toBeTruthy();
  });
});

describe("LabRegistry.get/delete", () => {
  it("throws LabNotFoundError for an unknown id", () => {
    const { registry } = makeRegistry();
    expect(() => registry.get("nope")).toThrow(LabNotFoundError);
  });

  it("removes the container and drops the record on delete", async () => {
    const { registry, driver } = makeRegistry();
    const lab = await registry.create();
    await registry.delete(lab.id);
    expect(driver.removed).toEqual(["container-1"]);
    expect(registry.list()).toHaveLength(0);
  });
});

describe("LabRegistry idle sweep", () => {
  it("leaves a lab alone while a socket is attached, even past the timeout", async () => {
    const { registry, driver, clock } = makeRegistry({ idleTimeoutMs: 1000 });
    const lab = await registry.create();
    registry.attachSocket(lab.id);
    clock.advance(5000);
    const removed = await registry.sweep();
    expect(removed).toEqual([]);
    expect(driver.removed).toEqual([]);
  });

  it("removes a lab with no attached sockets once idle past the timeout", async () => {
    const { registry, driver, clock } = makeRegistry({ idleTimeoutMs: 1000 });
    const lab = await registry.create();
    clock.advance(1500);
    const removed = await registry.sweep();
    expect(removed).toEqual([lab.id]);
    expect(driver.removed).toEqual(["container-1"]);
    expect(registry.list()).toHaveLength(0);
  });

  it("removes a lab whose last socket detached and then idled out", async () => {
    const { registry, clock } = makeRegistry({ idleTimeoutMs: 1000 });
    const lab = await registry.create();
    registry.attachSocket(lab.id);
    clock.advance(500);
    registry.detachSocket(lab.id);
    clock.advance(1500);
    const removed = await registry.sweep();
    expect(removed).toEqual([lab.id]);
  });

  it("does not sweep a lab still within the idle window", async () => {
    const { registry, clock } = makeRegistry({ idleTimeoutMs: 1000 });
    await registry.create();
    clock.advance(500);
    const removed = await registry.sweep();
    expect(removed).toEqual([]);
  });
});

describe("LabRegistry.touch", () => {
  it("resets the idle clock", async () => {
    const { registry, clock } = makeRegistry({ idleTimeoutMs: 1000 });
    const lab = await registry.create();
    clock.advance(900);
    registry.touch(lab.id);
    clock.advance(900);
    const removed = await registry.sweep();
    expect(removed).toEqual([]);
  });
});

describe("LabRegistry.removeAll", () => {
  it("removes every tracked lab even if the driver throws for one", async () => {
    const driver: ContainerDriver = {
      create: async (name) => ({ containerId: `c-${name}` }),
      remove: async (id) => {
        if (id === "c-rz-lab-lab-1") throw new Error("boom");
      },
    };
    let idCounter = 0;
    const registry = new LabRegistry({
      driver,
      maxLabs: 5,
      idleTimeoutMs: 1000,
      generateId: () => `lab-${++idCounter}`,
    });
    await registry.create();
    await registry.create();
    await registry.removeAll();
    expect(registry.list()).toHaveLength(0);
  });
});
