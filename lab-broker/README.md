# lab-broker

The earliest seed of the Phase 2 orchestrator (`docs/ROADMAP.md`). Owns
Docker container lifecycle and the browser terminal bridge for
**one practice lab at a time**, so `apps/web` (which runs serverless on
Vercel and never has a Docker socket of its own) never has to.

**Local-only, by design — see `docs/DECISIONS.md` 027.** This service is not
deployed anywhere; it runs next to Docker on your machine (WSL/Linux, or
Docker Desktop's engine directly on Windows/macOS) and `apps/web`'s
`/app/lab` route talks to it over `LAB_BROKER_URL`. Without a broker
running, `/app/lab` renders a clear "lab unavailable" state — it does not
crash the app or the Vercel build.

Standalone, **outside the pnpm workspace** — its own `package.json`/install,
matching `agent/`'s standalone-module precedent, and keeping Docker-facing
dependencies out of `apps/web`'s install and Vercel's bundle.

## Prerequisites

1. Docker running and reachable (Docker Desktop, or a Linux/WSL Docker
   daemon).
2. The `linux-practice` image built and the `rzagent` binary built — both
   already produced by `agent/scripts/prove.sh`, or do it directly:
   ```
   docker run --rm --platform linux/amd64 -v "$(pwd)/agent":/src -w /src \
     -e CGO_ENABLED=0 -e GOOS=linux -e GOARCH=amd64 \
     golang:1.23 go build -o /src/rzagent ./cmd/rzagent
   docker build --platform linux/amd64 -t rz-practice:latest agent/image
   ```
3. `npm install` inside `lab-broker/` (not `pnpm` — this package is
   intentionally outside the workspace).

## Running it

```
npm run dev     # tsx watch, listens on 127.0.0.1:8080 by default
```

Then in `apps/web`, set `LAB_BROKER_URL=http://127.0.0.1:8080` (see
`.env.example`) and open `/app/lab`.

### Config (env vars, all optional — defaults assume this repo's own checkout)

| Var | Default | |
|---|---|---|
| `HOST` | `127.0.0.1` | binds loopback only — never expose this past localhost |
| `PORT` | `8080` | |
| `RZ_IMAGE` | `rz-practice:latest` | |
| `RZAGENT_BIN` | `<repo>/agent/rzagent` | |
| `RZ_CHECKS` | `<repo>/agent/checks/linux-practice.yaml` | |
| `IDLE_TIMEOUT_MIN` | `30` | a lab with zero attached terminal sockets past this age is force-removed |
| `MAX_LABS` | `1` | scope for this session — see `docs/ROADMAP.md` Phase 2 |

## API

| Route | |
|---|---|
| `POST /labs` | Launches a container from `RZ_IMAGE`, copies `rzagent` + the check file in. `201 { id }`. `409` if `MAX_LABS` is already running; `503` if the image/binary prerequisites are missing. |
| `GET /labs` | Lists tracked labs (just `{ id }`s) — lets a client reconnect after a page reload instead of double-launching. |
| `WS /labs/:id/term` | Interactive shell (`/bin/bash -l`, real Docker-provided TTY). See protocol below. |
| `POST /labs/:id/score` | Runs `rzagent --checks ... --json` inside the container, returns the shaped report. |
| `DELETE /labs/:id` | Stops + force-removes the container. `204`. |

### Terminal WebSocket protocol

- Client → server **binary** frame = raw stdin bytes.
- Client → server **text** frame = JSON `{"type":"resize","cols":N,"rows":N}`.
- Server → client **binary** frame = raw container stdout/stderr (the shell
  has a real TTY, so Docker never multiplexes/frames it — bytes are exactly
  what a terminal emulator expects).
- Server → client **text** frame = JSON `{"type":"error","message":"..."}` if
  the shell couldn't be attached (the daemon or container went away).

No auth on the broker itself — acceptable for a single local user talking to
`127.0.0.1`; revisited when the orchestrator moves this off localhost
(`docs/DECISIONS.md` 027).

## Why dockerode + a `docker cp` shellout, not `node-pty`

The interactive shell is `docker exec` with `Tty: true`: the container's own
PTY, streamed over a hijacked Engine-API connection. That needs no *local*
PTY at all, so `node-pty` (native bindings, historically the flaky part of
Node-based terminal bridges on Windows/WSL) is never a dependency here.
Copying the `rzagent` binary + check file into a fresh container is the one
place this reaches for the `docker` CLI directly (`docker cp`, exactly the
command `agent/scripts/prove.sh` already proves works) instead of
dockerode's `putArchive` (which wants a tar stream) — avoids a `tar-stream`
dependency for one call site.

## Testing

```
npm test          # vitest — registry.ts (lifecycle/idle-sweep bookkeeping)
                   # and score.ts (rzagent JSON parsing/shaping), both pure,
                   # no Docker required
npm run typecheck
npm run prove      # the real thing: spawns the broker, launches a lab,
                   # drives the terminal WebSocket to run real fix commands
                   # inside the container, re-scores and asserts the score
                   # rose by exactly the expected amount, deletes the lab,
                   # and asserts `docker ps` no longer lists it. Requires
                   # Docker + the prerequisites above. Self-asserting, exits
                   # non-zero on any mismatch — mirrors agent/scripts/prove.sh.
```
