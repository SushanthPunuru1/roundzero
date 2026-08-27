# Phase 2 — Infrastructure (step 2 of the locked build order)

The goal in one sentence: **a lab runs for someone who is not the author.**

Everything else in this document exists because that sentence is a much
bigger jump than it sounds.

## Where we actually are

`lab-broker/` (DECISIONS 027) already does the hard interactive part: it
creates a container from `rz-practice:latest`, copies `rzagent` and the
check file in, serves a real container-side PTY over a WebSocket, runs the
32 checks on demand, and force-removes a lab that has been idle for 30
minutes. `LabRegistry` is pure and unit-tested behind a `ContainerDriver`
interface, so the bookkeeping is already separable from Docker.

What it is *not* is a service anyone but the author can reach. Today:

| | Today | Needed |
|---|---|---|
| Reachability | binds `127.0.0.1` only | public, over TLS |
| Authentication | ~~none at all~~ **done** — HMAC token on every route | per-user, per-lab, unforgeable |
| Tenancy | ~~no owner recorded~~ **done** — owner-scoped, per-user quota | many users, each isolated |
| Runtime | stock `runc` | `runsc` (gVisor) |
| Container caps | ~~`CapAdd: NET_ADMIN, NET_RAW`~~ now none, root, no limits | least privilege + hard limits |
| Egress | full outbound access | default-deny |
| Memory / CPU / PIDs | ~~unbounded~~ **done** — capped in `sandbox.ts` | capped per lab |
| Cold start | untested, unpooled | < 20s |

Loopback binding *was* the entire security model. It no longer is: tokens,
owner scoping, and resource caps have landed (DECISIONS 046/047), and the
broker now refuses to start on a non-loopback bind with no secret. What
remains before a public bind is the runtime, egress, and the host itself.

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

**Prove it on WSL2, not on the Hetzner box, and do it before buying one.**
The question is whether gVisor's netstack supports what `ufw` needs, and
netstack behaves the same regardless of which platform gVisor uses to
intercept syscalls (`systrap` in WSL2, likely KVM on the host). So the
answer transfers, and it is worth having *before* provisioning: if
`ufw-active` does not survive `runsc`, that changes the check, possibly the
image, and possibly the capability set — all of which are cheaper to change
before a host exists than after.

**The harness already exists.** `agent/scripts/prove.sh` builds the agent
and image, then asserts four exact scoring states: 0/266 on a fresh box,
266/266 hardened, 66 half-fixed, and a fourth. It now takes an optional
`RZ_RUNTIME`, so the gVisor proof is the same script run twice, and the gate
is that every number is identical:

```bash
# inside WSL2 (Ubuntu), from the repo root
bash agent/scripts/prove.sh                    # baseline: runc
RZ_RUNTIME=runsc bash agent/scripts/prove.sh   # the actual proof
```

That is a much stronger test than checking `ufw status` by hand: it exercises
every check against four different machine states, so a runtime that subtly
changes file modes, process visibility, or service detection shows up as a
wrong number rather than passing unnoticed.

**Gate:** every `prove.sh` assertion produces the same number under `runsc`
as under `runc`, across all four states plus the trap demo.

**Outcome: see "2.0 — RESOLVED" at the end of this document.** The prediction
that stood here — that `ufw-active` might survive as a file check — turned
out to be wrong for a reason worth keeping: the break is in the learner's
*action*, not the grader. Reasoning would have produced the file-check fix
and it would not have worked.

Installing `runsc`, once per Linux host. Verified on WSL2 Ubuntu; the same
sequence applies on the Hetzner box in 2.2, which is why it lives here
rather than in a scratch note:

```bash
sudo apt-get update && sudo apt-get install -y docker.io
curl -fsSL https://gvisor.dev/archive.key | sudo gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" | sudo tee /etc/apt/sources.list.d/gvisor.list > /dev/null
sudo apt-get update && sudo apt-get install -y runsc
sudo runsc install          # writes /etc/docker/daemon.json
sudo service docker restart
docker info | grep -i -A3 runtimes   # expect: runc runsc
```

On Windows, drive the whole thing from PowerShell without switching shells —
`wsl bash -lc '<command>'` keeps everything inside the quotes away from
PowerShell's parser, which otherwise mangles `&&`, `|`, and `VAR=value`.

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

### 2.2 — Provision the host *(deliberately AFTER 2.3)*

**Do not buy a box until the broker is safe to expose.** That was the
reason for putting 2.3 first, and it is now largely satisfied: auth, owner
scoping, quotas, and resource caps are in. What is still missing before a
public bind is TLS, egress lockdown, and the host hardening below — so the
box is worth buying once those are the only remaining gap, not before.

One Hetzner box. Docker, `runsc` installed and set as a named runtime,
host-level firewall default-deny inbound except SSH and the broker port,
unattended-upgrades on, SSH key-only. The broker runs as a non-root user in
the `docker` group — noting honestly that `docker` group membership is
root-equivalent, so the box's own hardening is what contains that.

**Capacity is a real number, not a guess.** Measured on WSL2, an idle
practice container costs:

| Runtime | Memory | PIDs |
|---|---|---|
| `runc` | 1.6 MiB | 1 |
| `runsc` | 17.2 MiB | 30 |

So gVisor's tax is ~15.6 MiB and ~29 PIDs per lab. Two consequences.

*Sizing.* Idle is a floor, not a budget — a learner running `find /`, `apt
upgrade`, or a build will use far more, and the 512 MiB cap in `sandbox.ts`
is the number to plan against for a worst case. Budgeting the full cap for
every concurrent lab is the safe read: on a 4 GB box, minus ~800 MiB for the
OS and broker, that is roughly six labs. Budgeting a realistic working set
instead (~150–250 MiB) roughly doubles it. Start from the conservative
number, because a queue that makes someone wait is strictly better than an
OOM that kills six live sessions — and Hetzner resizes up without a rebuild,
so the cheap mistake is recoverable and the expensive one is not.

*PID limits.* 30 of the 256-PID default are gone before the learner types
anything. Still ample, but do not read "256" as 256 available.

### 2.3 — Authentication and egress *(auth: DONE, DECISIONS 046/047/048)*

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

---

## 2.0 — RESOLVED (2026-08-25)

Run on WSL2 with `runsc` 20260817.0 and Docker 29.1.3. Outcome: **the second
of the three predicted branches.**

**State 1 was byte-identical under both runtimes** — 0 earned, 29 failing,
3 decoys passing. Every check *evaluates* correctly under gVisor: file modes,
package state, service enablement, process visibility, SUID discovery, cron
inspection. The scoring engine is runtime-independent, which was the thing
most worth knowing and is now known rather than assumed.

**`ufw` cannot work under gVisor, and no check rewrite fixes that.** The
failure is in the learner's *action*, not the grader:

```
runsc: ufw --force enable  ->  ERROR: Couldn't determine iptables version
                               EXIT=1, ENABLED=no
runc:  ufw --force enable  ->  Firewall is active and enabled on system startup
                               EXIT=0, ENABLED=yes, Status: active
```

Both iptables backends were tried. `nft` fails at `Failed to initialize nft:
Protocol not supported`; the legacy binary loads (`iptables v1.8.10
(legacy)`) but cannot initialize a single table — `unable to initialize table
'filter'`, repeated across every ufw rules file. gVisor's netstack simply
exposes no netfilter. So grading `/etc/ufw/ufw.conf` instead of `ufw status`
would not have helped: nothing writes `ENABLED=yes` because the enable itself
never completes.

**Decision: `ufw-active` leaves the lab check set.** 33 checks → 32,
276 points → 266, 30 planted vulns → 29. The skill stays fully taught —
`linux-updates-firewall-sysctl`, two Linux checklist items, three drill
cards — it is simply not gradeable in a sandbox with no real netfilter, and
isolation outranks a 10-point check. That tradeoff is not close: gVisor is
what stands between a curious teenager with root and every other lab on the
box.

**Unlocked by the removal:** `NET_ADMIN` and `NET_RAW` existed *only* for
ufw. Nothing in the remaining 32 checks touches the network stack, so a lab
container now runs with **zero added capabilities** — `CapDrop: ALL` and
nothing added back. That is a materially better starting position for §2.3
than the profile drafted a few hours earlier assumed.

**Consequence for §2.5 (observability) and the lab README:** a learner who
runs `ufw enable` in the lab will still see an iptables error. The generated
per-instance README must say plainly that the sandbox has no netfilter and
that firewall work is practiced via the checklist rather than scored here.
Silence there would read as a broken lab.

**Re-run after the removal: both runtimes reach
`PROVE.SH: all four states + the bonus trap demo scored as expected.`**
All 32 checks, four machine states, and the drop-in trap demo score
identically under `runc` and `runsc` — with no added capabilities in either.
**2.0 is closed.** gVisor is proven for this image, and the `runc` run
doubles as proof that nothing quietly depended on NET_ADMIN/NET_RAW.

The next blocking item is 2.2, provisioning, which is the first step that
costs money and the first that cannot be rehearsed locally.
