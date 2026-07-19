import path from "node:path";

export interface Config {
  host: string;
  port: number;
  image: string;
  rzagentBin: string;
  checksPath: string;
  idleTimeoutMs: number;
  maxLabs: number;
}

// lab-broker/src/config.ts -> lab-broker/src -> lab-broker -> repo root.
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

/** Every setting defaults so `pnpm dev`-style zero-config startup works
 * against this repo's own agent/ checkout; every default is overridable so
 * the same code moves to a remote host later (see docs/DECISIONS.md 027). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 8080),
    image: env.RZ_IMAGE || "rz-practice:latest",
    rzagentBin: env.RZAGENT_BIN || path.join(REPO_ROOT, "agent", "rzagent"),
    checksPath: env.RZ_CHECKS || path.join(REPO_ROOT, "agent", "checks", "linux-practice.yaml"),
    idleTimeoutMs: Number(env.IDLE_TIMEOUT_MIN || 30) * 60_000,
    maxLabs: Number(env.MAX_LABS || 1),
  };
}
