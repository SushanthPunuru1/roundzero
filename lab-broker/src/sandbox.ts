// The container security profile, as a pure function of config.
//
// Split out of docker.ts deliberately. docker.ts is I/O against a live
// daemon and is not unit-tested; this is the part that decides how much
// damage a lab can do, and a resource limit that silently stops being
// applied is invisible until the box falls over under a fork bomb. So the
// decision lives here, where sandbox.test.ts can assert it without Docker.
//
// See docs/PHASE2_INFRA_SPEC.md §2.1. Today's local broker runs one lab for
// the author on loopback; the profile below is written for the multi-tenant
// host, where the container holds an untrusted root shell.

import type Docker from "dockerode";

export interface SandboxLimits {
  /** Docker runtime name. Empty string means "Docker's default" (runc),
   * which is the only thing that works on Docker Desktop for Windows/macOS.
   * The Hetzner host sets this to "runsc" — gVisor needs a Linux kernel, so
   * it cannot be the default without breaking every local dev machine. */
  runtime: string;
  memoryBytes: number;
  nanoCpus: number;
  pidsLimit: number;
  /** Capabilities added back after dropping ALL. Empty, and that is the
   * finding rather than an oversight: NET_ADMIN/NET_RAW existed solely for
   * `ufw-active`, which spec §2.0 removed from the check set because gVisor
   * exposes no netfilter (DECISIONS 045). None of the remaining 32 checks
   * touches the network stack, so a lab runs at zero added privilege. */
  capAdd: string[];
  /** Docker network name, or empty for the default bridge. Per-lab networks
   * with default-deny egress are §2.3; until then this is empty and the
   * container has full outbound access, which is only acceptable because
   * the broker is loopback-only. */
  networkName: string;
}

export const DEFAULT_LIMITS: SandboxLimits = {
  runtime: "",
  memoryBytes: 512 * 1024 * 1024,
  nanoCpus: 1_000_000_000, // 1.0 CPU
  // 256 is generous for a shell session (<50 PIDs) and still stops a fork
  // bomb instantly. Measured caveat worth knowing before anyone lowers it:
  // an IDLE gVisor lab already holds ~30 PIDs, because the sandbox's own
  // process tree counts against the container's cgroup — versus 1 under
  // runc. A limit that looks generous for a shell can be nearly exhausted
  // by the runtime alone.
  pidsLimit: 256,
  capAdd: [],
  networkName: "",
};

/**
 * Builds the HostConfig for a lab container.
 *
 * Three properties this function exists to guarantee, each of which is a way
 * the box dies without it:
 *
 * - **Memory is capped and swap is pinned to it.** MemorySwap must equal
 *   Memory, not be left unset: unset means "twice Memory", so a container
 *   that looks capped at 512M can still consume 1G of swap and take the host
 *   down slowly instead of quickly.
 * - **PIDs are capped.** `:(){ :|:& };:` is four seconds of typing and is the
 *   single most likely thing an unsupervised teenager tries first.
 * - **Privilege only ever goes down.** CapDrop ALL then add back the few that
 *   a check provably needs, plus no-new-privileges so a SUID binary inside
 *   the image cannot walk it back up.
 */
export function buildHostConfig(limits: SandboxLimits): Docker.HostConfig {
  const config: Docker.HostConfig = {
    // Empty string is not the same as absent: Docker rejects an unknown
    // runtime, so a typo'd RZ_RUNTIME must fail loudly at create time rather
    // than silently falling back to runc — which would mean believing the
    // box is gVisor-isolated when it is not.
    ...(limits.runtime ? { Runtime: limits.runtime } : {}),

    Memory: limits.memoryBytes,
    MemorySwap: limits.memoryBytes,
    NanoCpus: limits.nanoCpus,
    PidsLimit: limits.pidsLimit,

    CapDrop: ["ALL"],
    CapAdd: [...limits.capAdd],
    SecurityOpt: ["no-new-privileges"],

    // A lab must never see the host filesystem. Stated as an explicit empty
    // array rather than omitted, so that adding a bind mount is a visible
    // edit to this line and not an absent-field oversight.
    Binds: [],

    // Restart policies and labs do not mix: a crashed lab should be reaped
    // by the registry, never resurrected behind its back.
    RestartPolicy: { Name: "no", MaximumRetryCount: 0 },

    ...(limits.networkName ? { NetworkMode: limits.networkName } : {}),
  };

  return config;
}

/** Reads the profile from the environment. Every value has a default that
 * works for local single-lab development, and every value is overridable so
 * the same code runs on the host (DECISIONS 027's config-driven rule). */
export function loadSandboxLimits(env: NodeJS.ProcessEnv = process.env): SandboxLimits {
  return {
    runtime: env.RZ_RUNTIME || DEFAULT_LIMITS.runtime,
    memoryBytes: Number(env.RZ_MEMORY_MB || 512) * 1024 * 1024,
    nanoCpus: Math.round(Number(env.RZ_CPUS || 1) * 1_000_000_000),
    pidsLimit: Number(env.RZ_PIDS_LIMIT || DEFAULT_LIMITS.pidsLimit),
    capAdd: env.RZ_CAP_ADD ? env.RZ_CAP_ADD.split(",").map((c) => c.trim()).filter(Boolean) : [...DEFAULT_LIMITS.capAdd],
    networkName: env.RZ_NETWORK || DEFAULT_LIMITS.networkName,
  };
}
