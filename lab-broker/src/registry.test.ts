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

function makeRegistry(
  overrides: {
    maxLabs?: number;
    maxLabsPerUser?: number;
    idleTimeoutMs?: number;
    maxLifetimeMs?: number;
  } = {},
) {
  const driver = new FakeDriver();
  const clock = new FakeClock();
  let idCounter = 0;
  const registry = new LabRegistry({
    driver,
    maxLabs: overrides.maxLabs ?? 1,
    maxLabsPerUser: overrides.maxLabsPerUser ?? 5,
    maxLifetimeMs: overrides.maxLifetimeMs,
    idleTimeoutMs: overrides.idleTimeoutMs ?? 1000,
    now: clock.now,
    generateId: () => `lab-${++idCounter}`,
  });
  return { registry, driver, clock };
}

describe("LabRegistry.create", () => {
  it("creates a lab via the driver and tracks it", async () => {
    const { registry, driver } = makeRegistry();
    const lab = await registry.create("user_1");
    expect(lab.id).toBe("lab-1");
    expect(lab.containerId).toBe("container-1");
    expect(driver.created).toEqual(["rz-lab-lab-1"]);
    expect(registry.list()).toHaveLength(1);
  });

  it("rejects a second lab once maxLabs is reached", async () => {
    // Two DIFFERENT users, so this exercises server capacity rather than
    // the per-user quota — those are separate limits and separate messages.
    const { registry } = makeRegistry({ maxLabs: 1 });
    await registry.create("user_1");
    await expect(registry.create("user_2")).rejects.toThrow(LabLimitExceededError);
  });

  it("allows a new lab after the first is deleted", async () => {
    const { registry } = makeRegistry({ maxLabs: 1 });
    const first = await registry.create("user_1");
    await registry.delete(first.id, "user_1");
    await expect(registry.create("user_1")).resolves.toBeTruthy();
  });
});

describe("LabRegistry.get/delete", () => {
  it("throws LabNotFoundError for an unknown id", () => {
    const { registry } = makeRegistry();
    expect(() => registry.get("nope")).toThrow(LabNotFoundError);
  });

  it("removes the container and drops the record on delete", async () => {
    const { registry, driver } = makeRegistry();
    const lab = await registry.create("user_1");
    await registry.delete(lab.id, "user_1");
    expect(driver.removed).toEqual(["container-1"]);
    expect(registry.list()).toHaveLength(0);
  });
});

describe("LabRegistry idle sweep", () => {
  it("leaves a lab alone while a socket is attached, even past the timeout", async () => {
    const { registry, driver, clock } = makeRegistry({ idleTimeoutMs: 1000 });
    const lab = await registry.create("user_1");
    registry.attachSocket(lab.id);
    clock.advance(5000);
    const removed = await registry.sweep();
    expect(removed).toEqual([]);
    expect(driver.removed).toEqual([]);
  });

  it("removes a lab with no attached sockets once idle past the timeout", async () => {
    const { registry, driver, clock } = makeRegistry({ idleTimeoutMs: 1000 });
    const lab = await registry.create("user_1");
    clock.advance(1500);
    const removed = await registry.sweep();
    expect(removed).toEqual([lab.id]);
    expect(driver.removed).toEqual(["container-1"]);
    expect(registry.list()).toHaveLength(0);
  });

  it("removes a lab whose last socket detached and then idled out", async () => {
    const { registry, clock } = makeRegistry({ idleTimeoutMs: 1000 });
    const lab = await registry.create("user_1");
    registry.attachSocket(lab.id);
    clock.advance(500);
    registry.detachSocket(lab.id);
    clock.advance(1500);
    const removed = await registry.sweep();
    expect(removed).toEqual([lab.id]);
  });

  it("does not sweep a lab still within the idle window", async () => {
    const { registry, clock } = makeRegistry({ idleTimeoutMs: 1000 });
    await registry.create("user_1");
    clock.advance(500);
    const removed = await registry.sweep();
    expect(removed).toEqual([]);
  });
});

describe("LabRegistry.touch", () => {
  it("resets the idle clock", async () => {
    const { registry, clock } = makeRegistry({ idleTimeoutMs: 1000 });
    const lab = await registry.create("user_1");
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
    // Two different users: shutdown teardown must not care whose lab it is,
    // and the default per-user quota is 1.
    await registry.create("user_1");
    await registry.create("user_2");
    await registry.removeAll();
    expect(registry.list()).toHaveLength(0);
  });
});

describe("ownership", () => {
  it("records the owner on the lab it creates", async () => {
    const { registry } = makeRegistry();
    const lab = await registry.create("user_1");
    expect(lab.ownerUserId).toBe("user_1");
  });

  // The whole point: one learner must not be able to see, touch, or delete
  // another's lab, and must not even be able to confirm it exists.
  it("hides another user's lab behind the same error as a missing one", async () => {
    const { registry } = makeRegistry({ maxLabs: 5 });
    const lab = await registry.create("user_1");

    // Same error type for both, so asking about a real-but-not-yours id is
    // indistinguishable from asking about one that never existed. (The HTTP
    // layer flattens both to a bare "Not found" as well — belt and braces,
    // since the message here echoes the requested id.)
    expect(() => registry.getOwned(lab.id, "user_2")).toThrow(LabNotFoundError);
    expect(() => registry.getOwned("no-such-lab", "user_2")).toThrow(LabNotFoundError);
    expect(() => registry.getOwned(lab.id, "user_1")).not.toThrow();
  });

  it("scopes list() to one owner, and returns everything when unscoped", async () => {
    const { registry } = makeRegistry({ maxLabs: 5 });
    await registry.create("user_1");
    await registry.create("user_2");
    await registry.create("user_1");

    expect(registry.list("user_1")).toHaveLength(2);
    expect(registry.list("user_2")).toHaveLength(1);
    expect(registry.list("user_3")).toHaveLength(0);
    expect(registry.list()).toHaveLength(3);
  });
});

describe("quotas", () => {
  // maxLabs alone is a shared pool one learner can drain — denial of service
  // by accident as easily as on purpose.
  it("stops one user filling the whole box", async () => {
    const { registry } = makeRegistry({ maxLabs: 10, maxLabsPerUser: 2 });
    await registry.create("greedy");
    await registry.create("greedy");

    await expect(registry.create("greedy")).rejects.toMatchObject({ scope: "user" });
    // Capacity remains for everyone else.
    await expect(registry.create("someone-else")).resolves.toBeTruthy();
  });

  it("reports server capacity and personal quota as different failures", async () => {
    const { registry } = makeRegistry({ maxLabs: 1, maxLabsPerUser: 1 });
    await registry.create("user_1");

    await expect(registry.create("user_2")).rejects.toMatchObject({ scope: "server" });

    const roomy = makeRegistry({ maxLabs: 10, maxLabsPerUser: 1 }).registry;
    await roomy.create("user_1");
    await expect(roomy.create("user_1")).rejects.toMatchObject({ scope: "user" });
  });

  it("frees the user's quota when their lab is deleted", async () => {
    const { registry } = makeRegistry({ maxLabs: 5, maxLabsPerUser: 1 });
    const lab = await registry.create("user_1");
    await expect(registry.create("user_1")).rejects.toThrow(LabLimitExceededError);
    await registry.delete(lab.id, "user_1");
    await expect(registry.create("user_1")).resolves.toBeTruthy();
  });
});

describe("maximum lifetime", () => {
  // The hole the idle rule leaves once labs are shared: a terminal left open
  // never goes idle, so without this one learner holds a slot forever.
  it("reaps a lab past its lifetime even with a socket attached and recent activity", async () => {
    const { registry, clock } = makeRegistry({ idleTimeoutMs: 1000, maxLifetimeMs: 5000 });
    const lab = await registry.create("user_1");
    registry.attachSocket(lab.id);

    clock.advance(4000);
    registry.touch(lab.id);
    expect(await registry.sweep()).toEqual([]);

    clock.advance(2000); // now 6000 old, still socketed and just touched
    registry.touch(lab.id);
    expect(await registry.sweep()).toEqual([lab.id]);
  });

  it("leaves a young, busy lab alone", async () => {
    const { registry, clock } = makeRegistry({ idleTimeoutMs: 1000, maxLifetimeMs: 60_000 });
    const lab = await registry.create("user_1");
    registry.attachSocket(lab.id);
    clock.advance(30_000);
    registry.touch(lab.id);
    expect(await registry.sweep()).toEqual([]);
  });

  it("has no lifetime cap unless one is configured", async () => {
    const { registry, clock } = makeRegistry({ idleTimeoutMs: 1000 });
    const lab = await registry.create("user_1");
    registry.attachSocket(lab.id);
    clock.advance(10_000_000);
    registry.touch(lab.id);
    expect(await registry.sweep()).toEqual([]);
  });
});

describe("delete is owner-scoped", () => {
  it("refuses to delete another user's lab, with the not-found error", async () => {
    const { registry } = makeRegistry({ maxLabs: 5 });
    const lab = await registry.create("user_1");
    await expect(registry.delete(lab.id, "user_2")).rejects.toThrow(LabNotFoundError);
    expect(registry.list()).toHaveLength(1);
  });

  // Null owner is the unauthenticated loopback path — auth.ts makes that
  // the only configuration where it is reachable.
  it("allows an unscoped delete when there is no owner to check", async () => {
    const { registry } = makeRegistry({ maxLabs: 5 });
    const lab = await registry.create("user_1");
    await expect(registry.delete(lab.id, null)).resolves.toBeUndefined();
    expect(registry.list()).toHaveLength(0);
  });
});
