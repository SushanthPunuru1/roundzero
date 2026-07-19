# RoundZero agent

Phase 2's scoring agent + first vulnerable practice image. Go, no runtime
deps, drops into any Linux container. This is **not** the orchestrator or
the browser terminal — those are later Phase 2 sessions (see `docs/ROADMAP.md`).
aeacus's YAML check format is the design reference only — this is a
clean-room schema and implementation (`docs/DECISIONS.md` 003, 026).

## Layout

```
agent/
  cmd/rzagent/          CLI entrypoint
  internal/system/      System interface (real + fake) every check evaluates against
  internal/checks/      check-file schema, 7 check-type evaluators, registry
  internal/report/      score report: totals, per-check pass/fail, JSON/text render
  checks/linux-practice.yaml   the check file for image/ (see below)
  image/                the linux-practice vulnerable Dockerfile + answer key + fixes
  scripts/prove.sh       builds everything and proves all 4 grading states
```

## Running it

Host Go is not assumed anywhere in this repo — the agent is built and
tested inside a `golang` container:

```
docker run --rm -v "$(pwd)/agent":/src -w /src golang:1.23 go test ./...
bash agent/scripts/prove.sh   # build + run the full 4-state proof (Docker only)
```

`prove.sh` builds the static agent binary, builds the `linux-practice`
image, and — from a fresh container each time — runs all four grading
states (fresh vulnerable, fully hardened, half-fixed, alternate SSH fix),
printing every score report and asserting each expected number. It exits
non-zero if any assertion fails.

## The check-file schema

```yaml
version: 1
image: linux-practice
checks:
  - id: ssh-permitrootlogin        # unique within the file
    title: "SSH disallows direct root login (merged config)"
    skillNode: linux.ssh.permitrootlogin   # must be a real leaf id in
                                            # packages/content/taxonomy/taxonomy.yaml
    points: 12
    type: sshd_config               # one of the 7 registered types below
    params: { key: permitrootlogin, value: "no" }
```

One `type` + `params` per check — deliberately no `all:`/`any:` composition.
Every planted vuln so far needs exactly one condition; if a future vuln
genuinely needs to combine conditions, that's a new check type (or a new
check), not an engine feature to build ahead of need.

### Check types

| type | params | passes when |
|---|---|---|
| `file_contains` | `path, pattern, present` | pattern's regex match against the file's content equals `present` (a missing file reads as empty content, so `present: false` is satisfied by deleting the file) |
| `file_mode` | `path, mode, compare?` | `compare: equals` (default): mode matches exactly. `compare: max`: the file grants no permission bits beyond `mode` (i.e. is at least as restrictive) |
| `user` | `username?, uid?, present` | a `/etc/passwd` entry matching the given username and/or uid exists (`present: true`) or doesn't (`present: false`) — give both to let either "delete the account" or "change its uid" satisfy a fix |
| `command` | `command, pattern, present` | running `command` via `sh -c` and regex-matching its stdout equals `present` |
| `service` | `name, state` (`enabled`\|`disabled`) | `systemctl --root=/ is-enabled <name>` reports `state` — the offline mode systemd itself provides for image-building tools, so it works without a booted init (see DECISIONS 026) |
| `package` | `name, present` | `dpkg-query` reports the package installed, matching `present` |
| `sshd_config` | `key, value` | sshd's **merged/effective** config (`sshd -T`, never the raw file) reports `key` == `value` |

Every check's evaluation logic is pure and unit-tested against
`internal/system.Fake` (`internal/checks/*_test.go`) — no Docker needed to
run `go test`.

## Why `sshd -T` (merged config), not the raw file

Ubuntu ships `Include /etc/ssh/sshd_config.d/*.conf` as the *first* line of
`sshd_config`, and sshd applies first-match-wins per directive — so a
drop-in (the real Ubuntu 24.04 cloud-init pattern) can silently override
anything the main file says, and grepping the main file would both produce
false negatives (a fix landed in the drop-in) and false positives (the main
file looks hardened but a drop-in overrides it). `checks/linux-practice.yaml`'s
`ssh-permitrootlogin` plants exactly this: the drop-in wins regardless of
what the main file says, so the only correct fix is editing (or removing)
the drop-in — `scripts/prove.sh` state 4 proves the check credits that fix,
and its bonus demo proves editing only the main file does *not* fix it.

## How to add vuln #11, #12, ... 30+

No engine change is needed for a vuln that fits an existing check type
(which has covered everything planted so far):

1. **Inject it** — add the Dockerfile step(s) to `image/Dockerfile`, with a
   comment block naming which check it's for (follow the existing style).
2. **Write its fix** — add `image/fixes/fix-<name>.sh`, and wire it into
   `fix-all.sh` (and `fix-half.sh` if you want it in that harness state).
3. **Score it** — add one entry to `checks/linux-practice.yaml`, reusing a
   real `skillNode` from `packages/content/taxonomy/taxonomy.yaml` (never
   invent one — CLAUDE.md rule 2).
4. **Document it** — add one entry to `image/answer-key.yaml` (or to
   `authorized:` if it's a decoy, not a scored vuln).
5. Add its check id (and any new assertions) to `scripts/prove.sh` if you
   want it covered by the 4-state proof.

A genuinely new *kind* of check (not covered by the 7 types above) means
adding one `Evaluator` in `internal/checks/` + registering it in `init()` —
still no change to `registry.go`, `cmd/rzagent`, or the report package.

## Decoys: the authorization model

Two checks in `checks/linux-practice.yaml` are worth 0 points and assert a
*positive* state instead of hunting for a vuln:

- `decoy-authorized-user` — an odd-named but legitimately-authorized account
  (`zzsync`) must stay present. It's also in the `sudo` group, same as the
  actually-unauthorized `mallory` — `unauthorized-sudo` keys on the specific
  name `mallory`, not "any unrecognized sudoer," so this proves the engine
  respects an authorization list instead of blanket-flagging.
- `decoy-required-ssh` — `ssh.socket` (README-required) must stay enabled;
  proves the engine credits a required service staying up rather than
  rewarding "disable everything" as a shortcut to a clean scan.

## Known scope limits (v1, not bugs)

- `service` checks only enabled/disabled (unit symlinks), not live
  active/running state — sufficient for every check planted so far. Live
  active-state polling (needed for the Phase 2 debrief's critical-service
  uptime %, DECISIONS 013) is a real future requirement, deferred until the
  orchestrator actually runs boot-capable lab containers.
- `faillock-deny`/`pwquality-minlen` only check their own `.conf` file's
  content, not whether the PAM stack (`/etc/pam.d/common-auth`, etc.)
  actually wires the module in. Real, addable as check #11+ without engine
  changes.
- `command` checks shell out via `sh -c`; the check file is trusted,
  repo-authored content, not student- or attacker-supplied — same trust
  boundary as every other content-as-code YAML in this repo.
