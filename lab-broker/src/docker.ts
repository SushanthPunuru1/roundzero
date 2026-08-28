// Thin, imperative Docker Engine wrapper — not unit-tested (it's I/O against
// a real Docker daemon; the pure bookkeeping around it lives in registry.ts
// and score.ts, which are). Implements registry.ts's ContainerDriver plus
// the two operations server.ts needs beyond create/remove: an interactive
// TTY shell (for the terminal WS) and a one-shot scoring exec.
//
// create/exec/resize/remove go through dockerode (the Docker Engine HTTP
// API) so the interactive shell never needs a *local* PTY — Tty:true on a
// hijacked exec stream gets the container's own PTY over the wire, which is
// exactly why this service needs no `node-pty` (see docs/DECISIONS.md 027).
// The one exception is copying the agent binary + check file into a fresh
// container: dockerode's putArchive expects a tar stream, and shelling out
// to the `docker` CLI's own `cp` reuses the exact command
// agent/scripts/prove.sh already proves works, without a new tar dependency.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import Docker from "dockerode";
import type { Duplex } from "node:stream";
import { PassThrough } from "node:stream";

import type { ContainerDriver } from "./registry";
import { buildHostConfig, loadSandboxLimits, type SandboxLimits } from "./sandbox";

const execFileAsync = promisify(execFile);

export class MissingPrerequisiteError extends Error {
  constructor(reason: string) {
    super(`lab-broker prerequisite missing: ${reason}`);
    this.name = "MissingPrerequisiteError";
  }
}

export class ExecFailedError extends Error {
  constructor(cmd: string, exitCode: number | null, stderr: string) {
    super(`"${cmd}" exited ${exitCode ?? "?"}: ${stderr.trim() || "(no stderr)"}`);
    this.name = "ExecFailedError";
  }
}

export interface ShellSession {
  stream: Duplex;
  resize(cols: number, rows: number): Promise<void>;
}

export interface DockerClientOptions {
  image: string;
  rzagentBin: string;
  checksPath: string;
  docker?: Docker;
  /** Defaults to the environment-derived profile. Injectable so a caller —
   * or a test — can pin the sandbox without touching process.env. */
  limits?: SandboxLimits;
}

export class DockerClient implements ContainerDriver {
  private readonly docker: Docker;
  private readonly image: string;
  private readonly rzagentBin: string;
  private readonly checksPath: string;
  private readonly limits: SandboxLimits;

  constructor(options: DockerClientOptions) {
    this.docker = options.docker ?? new Docker();
    this.image = options.image;
    this.rzagentBin = options.rzagentBin;
    this.checksPath = options.checksPath;
    this.limits = options.limits ?? loadSandboxLimits();
  }

  /** Fails fast and clearly instead of letting the first container create
   * surface an opaque Docker API error. */
  checkPrerequisites(): void {
    if (!existsSync(this.rzagentBin)) {
      throw new MissingPrerequisiteError(
        `rzagent binary not found at ${this.rzagentBin} — build it first (see agent/scripts/prove.sh or lab-broker/README.md).`,
      );
    }
    if (!existsSync(this.checksPath)) {
      throw new MissingPrerequisiteError(`check file not found at ${this.checksPath}`);
    }
  }

  /** The per-lab network's name, derived from the container's so the two can
   * always be found from each other — including by a human cleaning up by
   * hand after a crash. */
  private networkNameFor(containerName: string): string {
    return `${containerName}-net`;
  }

  /**
   * Creates the lab's own isolated network when egress is denied.
   *
   * `Internal: true` is the whole mechanism: Docker gives the network no
   * gateway, so nothing on it can route off the host. One network per lab
   * rather than one shared internal network, because a shared one would
   * block the internet while leaving every lab able to reach every other —
   * lateral movement between learners, which is worse than the problem it
   * would have solved.
   */
  private async createNetwork(containerName: string): Promise<string | null> {
    if (this.limits.egress !== "deny") return null;
    const name = this.networkNameFor(containerName);
    await this.docker.createNetwork({ Name: name, Internal: true, Driver: "bridge" });
    return name;
  }

  /** Best-effort: a leaked network is untidy but harmless, and throwing here
   * would turn a successful container teardown into a failed one. */
  private async removeNetwork(name: string): Promise<void> {
    await this.docker.getNetwork(name).remove().catch(() => undefined);
  }

  async create(containerName: string): Promise<{ containerId: string }> {
    this.checkPrerequisites();

    const networkName = await this.createNetwork(containerName);

    let container;
    try {
      container = await this.docker.createContainer({
        name: containerName,
        Image: this.image,
        Tty: false,
        // The security profile is a pure function in sandbox.ts so it can be
        // asserted without a daemon — see the note at the top of that file.
        HostConfig: buildHostConfig(this.limits, networkName),
      });
      await container.start();
    } catch (err) {
      // The network outlives a failed container create unless we say
      // otherwise, and it is named after a container that will never exist.
      if (networkName) await this.removeNetwork(networkName);
      throw err;
    }

    try {
      await execFileAsync("docker", ["cp", this.rzagentBin, `${container.id}:/usr/local/bin/rzagent`]);
      await execFileAsync("docker", ["cp", this.checksPath, `${container.id}:/opt/checks.yaml`]);
      await this.runExec(container.id, ["chmod", "+x", "/usr/local/bin/rzagent"]);
    } catch (err) {
      await container.remove({ force: true }).catch(() => undefined);
      if (networkName) await this.removeNetwork(networkName);
      throw err;
    }

    return { containerId: container.id };
  }

  async remove(containerId: string): Promise<void> {
    // Read the name BEFORE removing the container — afterwards there is
    // nothing left to derive the network's name from, and it would leak.
    let networkName: string | null = null;
    if (this.limits.egress === "deny") {
      try {
        const info = await this.docker.getContainer(containerId).inspect();
        // Docker prefixes inspected names with a slash.
        networkName = this.networkNameFor(info.Name.replace(/^\//, ""));
      } catch {
        // Container already gone; nothing to derive from, and the sweep
        // below would have nothing to remove anyway.
      }
    }

    await this.docker.getContainer(containerId).remove({ force: true });
    if (networkName) await this.removeNetwork(networkName);
  }

  /** Interactive `/bin/bash -l` with a real TTY, hijacked as a raw duplex
   * byte stream — no stdout/stderr multiplexing to undo (Tty:true disables
   * Docker's stream framing on both the create and start call). */
  async openShell(containerId: string): Promise<ShellSession> {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: ["/bin/bash", "-l"],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });
    const stream = await exec.start({ hijack: true, stdin: true, Tty: true });
    return {
      stream,
      resize: async (cols, rows) => {
        await exec.resize({ h: rows, w: cols });
      },
    };
  }

  /** Runs rzagent inside the container and returns its raw stdout text
   * (the caller — score.ts's shapeReport — parses/validates it). */
  async runScore(containerId: string): Promise<string> {
    const result = await this.runExec(containerId, [
      "rzagent",
      "--checks",
      "/opt/checks.yaml",
      "--json",
    ]);
    return result.stdout;
  }

  private async runExec(
    containerId: string,
    cmd: string[],
  ): Promise<{ stdout: string; stderr: string }> {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });
    const stream = await exec.start({ hijack: true, stdin: false, Tty: false });

    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.docker.modem as any).demuxStream(stream, stdout, stderr);

    await new Promise<void>((resolve, reject) => {
      stream.on("end", resolve);
      stream.on("error", reject);
    });

    const info = await exec.inspect();
    const out = Buffer.concat(stdoutChunks).toString("utf8");
    const err = Buffer.concat(stderrChunks).toString("utf8");
    if (info.ExitCode !== 0) {
      throw new ExecFailedError(cmd.join(" "), info.ExitCode, err);
    }
    return { stdout: out, stderr: err };
  }
}
