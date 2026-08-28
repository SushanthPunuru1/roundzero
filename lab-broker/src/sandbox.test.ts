import { describe, expect, it } from "vitest";

import {
  DEFAULT_LIMITS,
  InvalidSandboxConfigError,
  buildHostConfig,
  loadSandboxLimits,
  type SandboxLimits,
} from "./sandbox";

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

  it("omits NetworkMode when no per-lab network is given", () => {
    expect("NetworkMode" in buildHostConfig(DEFAULT_LIMITS, null)).toBe(false);
    expect("NetworkMode" in buildHostConfig(DEFAULT_LIMITS)).toBe(false);
  });

  it("attaches to the per-lab network when one is given", () => {
    expect(buildHostConfig(DEFAULT_LIMITS, "rz-lab-7-net").NetworkMode).toBe("rz-lab-7-net");
  });
});

describe("loadSandboxLimits", () => {
  it("defaults to a working local profile with no env at all", () => {
    const loaded = loadSandboxLimits({});
    expect(loaded.runtime).toBe("");
    expect(loaded.memoryBytes).toBe(512 * 1024 * 1024);
    expect(loaded.nanoCpus).toBe(1_000_000_000);
    // Zero added capabilities is the correct default now that ufw-active
    // is gone — see DECISIONS 045. If this ever goes back to a non-empty
    // list, agent/scripts/prove.sh must grant the same ones or the proof
    // and the broker will disagree about what a lab can do.
    expect(loaded.capAdd).toEqual([]);
  });

  it("reads the host profile from the environment", () => {
    const loaded = loadSandboxLimits({
      RZ_RUNTIME: "runsc",
      RZ_MEMORY_MB: "256",
      RZ_CPUS: "0.5",
      RZ_PIDS_LIMIT: "64",
      RZ_EGRESS: "deny",
    });
    expect(loaded.runtime).toBe("runsc");
    expect(loaded.memoryBytes).toBe(268435456);
    expect(loaded.nanoCpus).toBe(500_000_000);
    expect(loaded.pidsLimit).toBe(64);
    expect(loaded.egress).toBe("deny");
  });

  // Being able to reach zero capabilities matters: if 2.0 finds gVisor
  // doesn't need NET_ADMIN, the host should be able to grant none without
  // a code change.
  it("can still be given capabilities if a future check needs one", () => {
    expect(loadSandboxLimits({ RZ_CAP_ADD: "" }).capAdd).toEqual([]);
    expect(loadSandboxLimits({ RZ_CAP_ADD: " " }).capAdd).toEqual([]);
    expect(loadSandboxLimits({ RZ_CAP_ADD: "NET_ADMIN, NET_RAW" }).capAdd).toEqual([
      "NET_ADMIN",
      "NET_RAW",
    ]);
  });
});

describe("egress policy", () => {
  // Defaulting to "allow" looks backwards for a security setting. It is not:
  // this default only ever reaches a loopback dev broker, because auth.ts
  // refuses to start a non-loopback bind without a secret, and the host sets
  // RZ_EGRESS=deny explicitly. Defaulting to deny would mean every local
  // `npm run dev` quietly building labs that behave differently from the
  // ones this repo documents.
  it("allows egress by default, and only 'deny' turns it off", () => {
    expect(loadSandboxLimits({}).egress).toBe("allow");
    expect(loadSandboxLimits({ RZ_EGRESS: "deny" }).egress).toBe("deny");
  });

  // The correction that matters. An earlier draft fell back to "allow" on an
  // unrecognised value, which means a host that wrote RZ_EGRESS=Deny and
  // believes its labs are contained would silently run them with full
  // outbound access. Same failure the Runtime field avoids — believing you
  // are isolated when you are not — so it gets the same answer: throw.
  it("REFUSES a value that is neither deny nor allow, rather than guessing", () => {
    for (const value of ["DENY", "denied", "off", "true", "no-egress", "1"]) {
      expect(() => loadSandboxLimits({ RZ_EGRESS: value })).toThrow(InvalidSandboxConfigError);
    }
  });

  it("treats unset and empty as the local-dev default", () => {
    expect(loadSandboxLimits({}).egress).toBe("allow");
    expect(loadSandboxLimits({ RZ_EGRESS: "" }).egress).toBe("allow");
    expect(loadSandboxLimits({ RZ_EGRESS: "  " }).egress).toBe("allow");
  });

  it("accepts both explicit values, trimmed", () => {
    expect(loadSandboxLimits({ RZ_EGRESS: " deny " }).egress).toBe("deny");
    expect(loadSandboxLimits({ RZ_EGRESS: "allow" }).egress).toBe("allow");
  });
});
