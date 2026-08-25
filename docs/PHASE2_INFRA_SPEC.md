# Phase 2 — Infrastructure (step 2 of the locked build order)

The goal in one sentence: **a lab runs for someone who is not the author.**

Everything else in this document exists because that sentence is a much
bigger jump than it sounds.

## Where we actually are

`lab-broker/` (DECISIONS 027) already does the hard interactive part: it
creates a container from `rz-practice:latest`, copies `rzagent` and the
check file in, serves a real container-side PTY over a WebSocket, runs the
33 checks on demand, and force-removes a lab that has been idle for 30
minutes. `LabRegistry` is pure and unit-tested behind a `ContainerDriver`
interface, so the bookkeeping is already separable from Docker.

What it is *not* is a service anyone but the author can reach. Today:

| | Today | Needed |
|---|---|---|
| Reachability | binds `127.0.0.1` only | public, over TLS |
| Authentication | **none at all** | per-user, per-lab, unforgeable |
| Tenancy | `MAX_LABS=1`, no owner recorded | many users, each isolated |
| Runtime | stock `runc` | `runsc` (gVisor) |
| Container caps | `CapAdd: NET_ADMIN, NET_RAW`, root, no limits | least privilege + hard limits |
| Egress | full outbound access | default-deny |
| Memory / CPU / PIDs | **unbounded** | capped per lab |
| Cold start | untested, unpooled | < 20s |

Loopback binding is currently the *entire* security model. Removing it
without replacing it is the single most dangerous change in this project.

## Threat model — read before designing anything

This is different in kind from everything in Phase 1, and the difference is
worth stating plainly rather than discovering later.

**We are handing an untrusted stranger a root shell on our hardware.** Not
a sandboxed REPL, not a form — root, with a real kernel interface, on a box
we own and pay for. Three consequences follow, in descending order of how
badly they end:

1. **Container escape.** Root inside a `runc` container is one kernel bug
   away from root on the host, and from there every other user's lab.
   gVisor exists specifically to make that a two-step problem instead of a
   one-step one. It is non-negotiable before a single external user, and
   the spec already said so.
2. **The box becomes an attack platform.** Outbound access from a root
   shell means our IP address scanning, brute-forcing, or mining on
   someone else's behalf. Egress lockdown is not primarily about protecting
   *us*; it is about not becoming the thing that attacks a third party. An
   abuse complaint to Hetzner ends the project's hosting.
3. **Denial of service, trivially.** With no memory, CPU, or PID limits, a
   fork bomb or `dd if=/dev/zero` takes the host down and every concurrent
   learner with it. This is the cheapest attack and the one most likely to
   happen by accident.

And the constraint that outranks the others: **minors use this platform**
(`CLAUDE.md` golden rule 8). "We'll tighten it after the first users" is not
available here.

## Build order

Sequenced so that the thing most likely to invalidate the design gets proven
first, and so that nothing internet-facing exists until the isolation
underneath it does.

### 2.0 — Prove gVisor runs the practice image *(blocking, but NOT first)*

**This step needs a Linux host and therefore cannot precede 2.2.** That was
got wrong in the first draft of this document, and the mistake is worth
recording because it is an easy one to repeat: the work was sequenced by
which unknown was riskiest, without asking where that unknown could
actually be *measured*. gVisor requires a Linux kernel; `runsc` does not run
under Docker Desktop on Windows or macOS. So the order is 2.1 (local,
runtime-independent) → 2.2 (provision) → 2.0 (prove, on the box) → the rest.

Do run the **`runc` baseline locally** first, though — it costs nothing and
2.0's gate is a comparison, so the baseline has to exist either way:

```
docker run --rm --cap-add=NET_ADMIN --cap-add=NET_RAW rz-practice:latest bash -lc "ufw --force enable && ufw status"
```

Everything below assumes `runsc` can run `rz-practice`. That assumption has
one identifiable weak point.

Of the 33 checks, 32 are file, content, account, or service inspection and
are indifferent to the runtime. **One is not: `ufw-active` runs `ufw
status`**, which is why `docker.ts` currently adds `NET_ADMIN` and
`NET_RAW`. gVisor implements its own network stack in userspace with only
partial iptables/nftables support, so this is the check that may not
survive the runtime change.

(The three `sysctl-*` checks are already safe: they deliberately grade the
*file* at `/etc/sysctl.d/99-roundzero.conf`, never live `sysctl`, because
Docker's namespacing already forced that workaround. The same decision pays
off again here — worth noticing as a pattern.)

Prove it directly:

```
docker run --rm --runtime=runsc --cap-add=NET_ADMIN --cap-add=NET_RAW \
  rz-practice:latest bash -lc "ufw --force enable && ufw status"
```

Three possible outcomes, and each changes the plan differently:

- **Works.** Nothing changes. Proceed to 2.1.
- **Fails, but `ufw` state is still readable from its config files.** Rewrite
  `ufw-active` as a file check, the way the sysctl checks already are. Cheap,
  and arguably more honest — it grades persistent configuration rather than
  live daemon state.
- **Fails in a way that breaks the shell or the agent.** Stop and reconsider
  the isolation layer. Do not proceed by dropping gVisor.

**Gate:** all 33 checks produce the same report under `runsc` as under
`runc`, on both a clean image and one where `fix-all.sh` has run.

### 2.1 — Harden the container spec *(local, testable now)*

Independent of the host, and the highest safety-per-line change available.
Today's `HostConfig` is two capabilities and nothing else. It needs:

- `Runtime: "runsc"`
- `Memory`, `MemorySwap` (equal, to forbid swap), `NanoCPUs`, `PidsLimit`
- `CapDrop: ["ALL"]`, then add back only what 2.0 proves is required
- `ReadonlyRootfs` where the image allows, with explicit writable mounts
- `--security-opt no-new-privileges`
- A per-lab network (see 2.3), never the default bridge
- No bind mounts from the host, ever

`registry.ts`'s `ContainerDriver` seam means the produced `HostConfig` can be
asserted in a unit test without a Docker daemon. Do that: a resource limit
that silently stops being applied is invisible until the box falls over.

### 2.2 — Provision the host

One Hetzner box. Docker, `runsc` installed and set as a named runtime,
host-level firewall default-deny inbound except SSH and the broker port,
unattended-upgrades on, SSH key-only. The broker runs as a non-root user in
the `docker` group — noting honestly that `docker` group membership is
root-equivalent, so the box's own hardening is what contains that.

**Capacity is a real number, not a guess.** Measure the practice container's
steady-state memory and pick `MAX_LABS` from it with headroom, then hold the
line: a queue that makes someone wait is strictly better than an OOM that
kills six live sessions.

### 2.3 — Authentication and egress

The two changes that make public exposure survivable.

**Auth.** `apps/web` knows who the user is; the broker does not and must
not have to ask. Mint a short-lived signed token (HMAC over user id + lab
id + expiry, shared secret in both environments) in a server action, and
have the broker verify it on every route. The awkward case is the terminal:
the browser connects to the broker's WebSocket directly — Vercel's
serverless runtime is a poor WS proxy — so the token travels in the
connection and must be verified **before** the shell is attached, not after.

Every lab row gains an owner. `GET /labs` stops listing everyone's labs.
`WS /labs/:id/term` refuses a lab the caller doesn't own. This is the
`requireForkEditor` lesson from DECISIONS 043 applied one layer down: put
the ownership decision in one pure, tested function and route every entry
point through it.

**Egress.** Per-lab Docker network, default-deny outbound. If any check
needs the network (`apt` in a fix path is the one to look for), allow
exactly that destination and nothing else. Default-deny first, then open
what breaks — never the reverse.

### 2.4 — Pooling and lifecycle

Cold start under 20s is a *product* requirement: a learner who waits a
minute stops using the lab. Container create and start are fast; the cost is
image pull (pre-pull at boot) and the `docker cp` of the agent and checks
(bake them into the image instead, or keep a warm pool of ready containers).

Lifecycle needs three things the local broker has only one of: the existing
idle timeout, a **hard maximum lifetime** regardless of activity, and
**orphan reaping on broker start** so a crash doesn't leak containers that
hold memory forever.

### 2.5 — Observability, minimally

Enough to answer "is it up, how many labs, did one die and why" — structured
logs and a `/health` endpoint with counts. Prometheus and Grafana are on the
deferred list (`CLAUDE.md`) and stay there; this is a log line and a JSON
route, not a stack.

Log no request bodies and no personal data (golden rule 8). A lab id and a
user id are enough.

## Gate

From `ROADMAP.md`, evaluated **after** the design pass, not before:

- 25 external users complete a lab
- cold start < 20s
- **zero isolation incidents**

The third is not a metric that trends. It is a binary, and the honest way to
approach it is to assume the first serious attempt to escape will come from
a curious teenager who is better at this than expected — because that is
precisely the population the platform recruits.

## Division of labour

Most of this needs a real Docker daemon, a real host, and real network
policy, none of which exist in an agent sandbox. What can be written and
tested without them: the container `HostConfig` and its assertions (2.1), the
token mint/verify pair and its tests (2.3), the pure lifecycle bookkeeping in
`registry.ts` (2.4), and every line of this document.

What cannot: 2.0's proof, 2.2 entirely, and every end-to-end verification.
Those run on the box.
