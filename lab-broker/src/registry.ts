// Pure lab-lifecycle bookkeeping: no Docker, no I/O. The actual container
// create/remove call is delegated to an injected ContainerDriver so this
// module is fully unit-testable with a Fake driver + a fake clock. The real
// driver (docker.ts) wraps dockerode.

export interface ContainerDriver {
  create(containerName: string): Promise<{ containerId: string }>;
  remove(containerId: string): Promise<void>;
}

export interface LabRecord {
  id: string;
  /** Better Auth user id of the learner this lab belongs to. Recorded at
   * creation and never changed — every lookup that can reach a container is
   * scoped through it (DECISIONS 046). */
  ownerUserId: string;
  containerId: string;
  containerName: string;
  createdAt: Date;
  lastActivity: Date;
  socketCount: number;
}

/** Two different "no": the server is full, or you personally already have
 * as many labs as you may have. They need different messages because the
 * user's next action differs — wait, versus stop your own lab. */
export class LabLimitExceededError extends Error {
  readonly scope: "server" | "user";
  constructor(scope: "server" | "user", max: number) {
    super(
      scope === "user"
        ? `You already have ${max} lab${max === 1 ? "" : "s"} running. Stop it before launching another.`
        : `The server is at capacity (${max} labs). Try again in a few minutes.`,
    );
    this.name = "LabLimitExceededError";
    this.scope = scope;
  }
}

export class LabNotFoundError extends Error {
  constructor(id: string) {
    super(`No lab with id "${id}"`);
    this.name = "LabNotFoundError";
  }
}

export interface LabRegistryOptions {
  driver: ContainerDriver;
  /** Total labs this broker will run at once — the box's capacity. */
  maxLabs: number;
  /** Labs any ONE user may hold. Without this, `maxLabs` is a shared pool a
   * single learner can drain, which is denial of service by accident as
   * easily as on purpose. */
  maxLabsPerUser?: number;
  idleTimeoutMs: number;
  /** Hard ceiling on a lab's age, regardless of activity. `idleTimeoutMs`
   * alone is not enough once there is more than one user: a terminal left
   * open never goes idle, so a single learner could hold a slot forever
   * without doing anything wrong. */
  maxLifetimeMs?: number;
  now?: () => Date;
  generateId?: () => string;
  containerNamePrefix?: string;
}

/** Deactivate-never-mutate-in-place bookkeeping for the (at most `maxLabs`)
 * containers this broker process owns. */
export class LabRegistry {
  private readonly driver: ContainerDriver;
  private readonly maxLabs: number;
  private readonly maxLabsPerUser: number;
  private readonly idleTimeoutMs: number;
  private readonly maxLifetimeMs: number;
  private readonly now: () => Date;
  private readonly generateId: () => string;
  private readonly containerNamePrefix: string;
  private readonly labs = new Map<string, LabRecord>();

  constructor(options: LabRegistryOptions) {
    this.driver = options.driver;
    this.maxLabs = options.maxLabs;
    this.maxLabsPerUser = options.maxLabsPerUser ?? 1;
    this.idleTimeoutMs = options.idleTimeoutMs;
    this.maxLifetimeMs = options.maxLifetimeMs ?? Number.POSITIVE_INFINITY;
    this.now = options.now ?? (() => new Date());
    this.generateId = options.generateId ?? (() => crypto.randomUUID());
    this.containerNamePrefix = options.containerNamePrefix ?? "rz-lab-";
  }

  /** Every lab on the broker. Internal callers only — the HTTP layer must
   * use the owner-scoped overload, or one user learns another's lab ids. */
  list(ownerUserId?: string): LabRecord[] {
    const all = [...this.labs.values()];
    return ownerUserId === undefined ? all : all.filter((l) => l.ownerUserId === ownerUserId);
  }

  get(id: string): LabRecord {
    const lab = this.labs.get(id);
    if (!lab) throw new LabNotFoundError(id);
    return lab;
  }

  /**
   * The lookup every request-handling path must use.
   *
   * A lab that exists but belongs to someone else raises LabNotFoundError —
   * deliberately the same error as one that does not exist. A distinct
   * "forbidden" would confirm the id is real, which is exactly the leak the
   * token layer avoids by never returning its failure reason to the client.
   */
  getOwned(id: string, ownerUserId: string): LabRecord {
    const lab = this.labs.get(id);
    if (!lab || lab.ownerUserId !== ownerUserId) throw new LabNotFoundError(id);
    return lab;
  }

  async create(ownerUserId: string): Promise<LabRecord> {
    if (this.labs.size >= this.maxLabs) {
      throw new LabLimitExceededError("server", this.maxLabs);
    }
    if (this.list(ownerUserId).length >= this.maxLabsPerUser) {
      throw new LabLimitExceededError("user", this.maxLabsPerUser);
    }
    const id = this.generateId();
    const containerName = `${this.containerNamePrefix}${id}`;
    const { containerId } = await this.driver.create(containerName);
    const createdAt = this.now();
    const lab: LabRecord = {
      id,
      ownerUserId,
      containerId,
      containerName,
      createdAt,
      lastActivity: createdAt,
      socketCount: 0,
    };
    this.labs.set(id, lab);
    return lab;
  }

  /** `ownerUserId` null means "no scoping" — reachable only on an
   * unauthenticated loopback broker, which auth.ts makes the sole
   * configuration where that is possible. */
  async delete(id: string, ownerUserId: string | null): Promise<void> {
    const lab = ownerUserId === null ? this.get(id) : this.getOwned(id, ownerUserId);
    await this.driver.remove(lab.containerId);
    this.labs.delete(id);
  }

  /** Marks activity (WS traffic, a score run) so the idle sweep leaves it alone. */
  touch(id: string): void {
    this.get(id).lastActivity = this.now();
  }

  attachSocket(id: string): void {
    const lab = this.get(id);
    lab.socketCount += 1;
    lab.lastActivity = this.now();
  }

  detachSocket(id: string): void {
    const lab = this.get(id);
    lab.socketCount = Math.max(0, lab.socketCount - 1);
    lab.lastActivity = this.now();
  }

  /**
   * Removes labs that are done, by either of two independent rules:
   *
   * - **Idle**: no attached terminal socket and no activity past
   *   `idleTimeoutMs`.
   * - **Too old**: past `maxLifetimeMs` since creation, *regardless* of
   *   sockets or activity. This one exists because the idle rule alone is
   *   defeated by simply leaving a terminal open — fine for a single-user
   *   broker, a way to hold a slot indefinitely once labs are shared.
   *
   * Returns the ids it removed. An error removing one lab does not stop the
   * sweep from trying the rest.
   */
  async sweep(): Promise<string[]> {
    const nowMs = this.now().getTime();
    const idleCutoff = nowMs - this.idleTimeoutMs;
    const removed: string[] = [];
    for (const lab of this.list()) {
      const tooOld = nowMs - lab.createdAt.getTime() >= this.maxLifetimeMs;
      if (!tooOld) {
        if (lab.socketCount > 0) continue;
        if (lab.lastActivity.getTime() > idleCutoff) continue;
      }
      try {
        await this.driver.remove(lab.containerId);
      } finally {
        this.labs.delete(lab.id);
        removed.push(lab.id);
      }
    }
    return removed;
  }

  /** Removes every tracked lab, best-effort — used on process shutdown so
   * nothing leaks past this broker exiting. */
  async removeAll(): Promise<void> {
    for (const lab of this.list()) {
      try {
        await this.driver.remove(lab.containerId);
      } catch {
        // best-effort on shutdown
      } finally {
        this.labs.delete(lab.id);
      }
    }
  }
}
