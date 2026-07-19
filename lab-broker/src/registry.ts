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
  containerId: string;
  containerName: string;
  createdAt: Date;
  lastActivity: Date;
  socketCount: number;
}

export class LabLimitExceededError extends Error {
  constructor(max: number) {
    super(
      `A lab is already running (max ${max} at a time on this broker). Stop it before launching another.`,
    );
    this.name = "LabLimitExceededError";
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
  maxLabs: number;
  idleTimeoutMs: number;
  now?: () => Date;
  generateId?: () => string;
  containerNamePrefix?: string;
}

/** Deactivate-never-mutate-in-place bookkeeping for the (at most `maxLabs`)
 * containers this broker process owns. */
export class LabRegistry {
  private readonly driver: ContainerDriver;
  private readonly maxLabs: number;
  private readonly idleTimeoutMs: number;
  private readonly now: () => Date;
  private readonly generateId: () => string;
  private readonly containerNamePrefix: string;
  private readonly labs = new Map<string, LabRecord>();

  constructor(options: LabRegistryOptions) {
    this.driver = options.driver;
    this.maxLabs = options.maxLabs;
    this.idleTimeoutMs = options.idleTimeoutMs;
    this.now = options.now ?? (() => new Date());
    this.generateId = options.generateId ?? (() => crypto.randomUUID());
    this.containerNamePrefix = options.containerNamePrefix ?? "rz-lab-";
  }

  list(): LabRecord[] {
    return [...this.labs.values()];
  }

  get(id: string): LabRecord {
    const lab = this.labs.get(id);
    if (!lab) throw new LabNotFoundError(id);
    return lab;
  }

  async create(): Promise<LabRecord> {
    if (this.labs.size >= this.maxLabs) {
      throw new LabLimitExceededError(this.maxLabs);
    }
    const id = this.generateId();
    const containerName = `${this.containerNamePrefix}${id}`;
    const { containerId } = await this.driver.create(containerName);
    const createdAt = this.now();
    const lab: LabRecord = {
      id,
      containerId,
      containerName,
      createdAt,
      lastActivity: createdAt,
      socketCount: 0,
    };
    this.labs.set(id, lab);
    return lab;
  }

  async delete(id: string): Promise<void> {
    const lab = this.get(id);
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

  /** Removes any lab with zero attached terminal sockets that has been idle
   * past idleTimeoutMs. Returns the ids it removed. Errors removing one lab
   * don't stop the sweep from trying the rest. */
  async sweep(): Promise<string[]> {
    const cutoff = this.now().getTime() - this.idleTimeoutMs;
    const removed: string[] = [];
    for (const lab of this.list()) {
      if (lab.socketCount > 0) continue;
      if (lab.lastActivity.getTime() > cutoff) continue;
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
