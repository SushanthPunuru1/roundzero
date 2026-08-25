import { describe, expect, it } from "vitest";

import { DEFAULT_LIMITS, buildHostConfig, loadSandboxLimits, type SandboxLimits } from "./sandbox";

const limits = (over: Partial<SandboxLimits> = {}): SandboxLimits => ({ ...DEFAULT_LIMITS, ...over });

describe("buildHostConfig — resource limits", () => {
  // The subtle one. Docker treats an unset MemorySwap as "twice Memory", so
  // a container that looks capped at 512M could still eat 1G of swap. These
  // two values have to be asserted together or the cap is half a cap.
  it("pins swap to the memory limit rather than leaving it unset", () => {
    const config = buildHostConfig(limits({ memoryBytes: 512 * 1024 * 1024 }));
    expect(config.Memory).toBe(536870912);
    expect(config.MemorySwap).toBe(config.Memory);
  });

  it("caps CPU and PIDs", () => {
    const config = buildHostConfig(limits({ nanoCpus: 1_500_000_000, pidsLimit: 128 }));
    expect(config.NanoCpus).toBe(1_500_000_000);
    expect(config.PidsLimit).toBe(128);
  });

  // A fork bomb is four seconds of typing and is the likeliest first thing
  // an unsupervised learner tries. There must always be a number here.
  it("never leaves PidsLimit unset by default", () => {
    const config = buildHostConfig(DEFAULT_LIMITS);
    expect(config.PidsLimit).toBeGreaterThan(0);
    expect(config.Memory).toBeGreaterThan(0);
    expect(config.NanoCpus).toBeGreaterThan(0);
  });
});

describe("buildHostConfig — privilege", () => {
  it("drops every capability before adding any back", () => {
    const config = buildHostConfig(limits({ capAdd: ["NET_ADMIN"] }));
    expect(config.CapDrop).toEqual(["ALL"]);
    expect(config.CapAdd).toEqual(["NET_ADMIN"]);
  });

  it("sets no-new-privileges so a SUID binary can't walk privilege back up", () => {
    expect(buildHostConfig(DEFAULT_LIMITS).SecurityOpt).toContain("no-new-privileges");
  });

  it("mounts nothing from the host", () => {
    expect(buildHostConfig(DEFAULT_LIMITS).Binds).toEqual([]);
  });

  // A restarting lab is a lab the registry has lost track of — its idle
  // timer and its owner record both belong to the broker, not to Docker.
  it("never restarts a container behind the registry's back", () => {
    expect(buildHostConfig(DEFAULT_LIMITS).RestartPolicy).toEqual({
      Name: "no",
      MaximumRetryCount: 0,
    });
  });
});

describe("buildHostConfig — runtime", () => {
  // The reason this is a config value and not a constant: gVisor needs a
  // Linux kernel, so hardcoding "runsc" would break every local dev machine
  // on Windows or macOS. See PHASE2_INFRA_SPEC.md 2.0.
  it("omits Runtime entirely when unset, so Docker's default applies", () => {
    expect("Runtime" in buildHostConfig(limits({ runtime: "" }))).toBe(false);
  });

  it("passes the runtime through when the host sets one", () => {
    expect(buildHostConfig(limits({ runtime: "runsc" })).Runtime).toBe("runsc");
  });

  it("omits NetworkMode when no per-lab network is configured", () => {
    expect("NetworkMode" in buildHostConfig(limits({ networkName: "" }))).toBe(false);
    expect(buildHostConfig(limits({ networkName: "rz-lab-7" })).NetworkMode).toBe("rz-lab-7");
  });
});

describe("loadSandboxLimits", () => {
  it("defaults to a working local profile with no env at all", () => {
    const loaded = loadSandboxLimits({});
    expect(loaded.runtime).toBe("");
    expect(loaded.memoryBytes).toBe(512 * 1024 * 1024);
    expect(loaded.nanoCpus).toBe(1_000_000_000);
    expect(loaded.capAdd).toEqual(["NET_ADMIN", "NET_RAW"]);
  });

  it("reads the host profile from the environment", () => {
    const loaded = loadSandboxLimits({
      RZ_RUNTIME: "runsc",
      RZ_MEMORY_MB: "256",
      RZ_CPUS: "0.5",
      RZ_PIDS_LIMIT: "64",
      RZ_NETWORK: "rz-lab-net",
    });
    expect(loaded.runtime).toBe("runsc");
    expect(loaded.memoryBytes).toBe(268435456);
    expect(loaded.nanoCpus).toBe(500_000_000);
    expect(loaded.pidsLimit).toBe(64);
    expect(loaded.networkName).toBe("rz-lab-net");
  });

  // Being able to reach zero capabilities matters: if 2.0 finds gVisor
  // doesn't need NET_ADMIN, the host should be able to grant none without
  // a code change.
  it("accepts an explicitly empty capability list", () => {
    expect(loadSandboxLimits({ RZ_CAP_ADD: "" }).capAdd).toEqual(["NET_ADMIN", "NET_RAW"]);
    expect(loadSandboxLimits({ RZ_CAP_ADD: " " }).capAdd).toEqual([]);
    expect(loadSandboxLimits({ RZ_CAP_ADD: "NET_ADMIN, NET_RAW" }).capAdd).toEqual([
      "NET_ADMIN",
      "NET_RAW",
    ]);
  });
});
