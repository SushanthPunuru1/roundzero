# RoundZero — Claude Code Context

Free, open-source, browser-based training platform for CyberPatriot teams.
Chromebook-first. The debrief is the product. Independent and unofficial.
Full product spec: `docs/spec.md`. Roadmap and gates: `docs/ROADMAP.md`.

## Current focus

**Sequencing authority: `docs/ROADMAP.md`'s "Locked build order" section.**
That section supersedes the calendar map and phase gates elsewhere in the
roadmap — read it before starting work, don't restate it here.

Active slice: the Linux lesson set (step 1.1 of the locked order). Next up
after that is the checklist trio — team fork (customize, add, reorder),
diff against upstream canonical, and print/PDF export (load-bearing: teams
use printed references during a round). The pure fork/diff/reorder logic is
already done and unit-tested in `packages/db/src/checklists/fork.ts`; no
migration is needed, the schema already carries `sourceVersion`,
`upstreamItemId`, `removed`, and nullable overrides. Still to build: server
actions, the `/app/checklists/[id]` editing UI, the diff view, and the
print surface.

Two fork invariants worth not rediscovering: a fork stores OVERRIDES, not
copies (an untouched item keeps inheriting upstream corrections; only
edited fields pin), and removal is a soft-hide (`removed: true`) so the
diff can tell a deliberate team drop from an item upstream never had.

Infrastructure (orchestrator, gVisor, pooling, cloud deploy) and the full
design pass both stay explicitly later, per the locked order. If a task
drifts past the current slice, stop and flag it instead of building it.

## Golden rules

1. **Never build ahead of the current milestone.** The spec is large on
   purpose; the roadmap exists to sequence it. Seductive Phase 5 features
   built early are bugs.
2. **The taxonomy is the spine.** Every lesson, checklist item, drill card,
   and (later) vuln template references a stable skill-node ID from
   `packages/content/taxonomy/taxonomy.yaml`. Never invent ad-hoc category
   strings. Never rename a node ID — deprecate and add.
3. **Compose UI from `packages/ui` only.** No one-off inline styles, no new
   colors/fonts/radii outside `DESIGN.md` tokens. If a screen needs a new
   primitive, add it to `packages/ui` first, tokenized.
4. **Free-tier discipline.** Never add a paid service, paid font, or paid
   dependency. The platform runs on club-budget money.
5. **Chromebook-first.** Every core feature must work in a browser tab on a
   locked-down school Chromebook. Keyboard-complete, low bandwidth.
6. **Integrity by design.** Nothing may ever help a team cheat in a live
   round: no live-round content, no official image uploads, no answer banks.
   This constraint overrides feature requests.
7. **No new dependencies without a `docs/DECISIONS.md` entry.** One-line ADR
   minimum: what, why, what it replaced.
8. **Minors use this platform.** Data minimization always: display handle,
   grade band, no DOB, no unnecessary PII. Never log request bodies
   containing personal data.
9. **No early user testing, soft launches, or club onboarding before the
   design pass.** This was decided, not an open question — see
   `docs/ROADMAP.md`'s locked build order.

## Stack (locked — change only via docs/DECISIONS.md)

- Next.js (App Router) + TypeScript strict, pnpm workspaces monorepo
- Tailwind CSS v4 + shadcn/ui, tokens defined in `DESIGN.md`
- Postgres on Neon + Prisma (`packages/db`)
- Better Auth: Google + magic link (Resend), organization plugin — one
  Better Auth organization == one team
- ts-fsrs for spaced-repetition scheduling
- Deployed on Vercel; every PR gets a preview
- Phase 2: Go scoring agent + injector (`agent/`, done). `lab-broker/`
  (Node/TS) is the local, single-lab seed of the eventual orchestrator
  service on a Hetzner box — see `docs/DECISIONS.md` 027.

## Repo layout

```
apps/web              Next.js app (all product surface for Phase 1)
packages/ui           Component library — the only source of UI primitives
packages/db           Prisma schema, client singleton, seed scripts
packages/content      taxonomy.yaml, MDX lessons, checklist YAML, drill cards
docs/                 spec.md, ROADMAP.md, DECISIONS.md
agent/                Go scoring agent + linux-practice vulnerable image (done)
lab-broker/           Local Docker lifecycle + terminal bridge for /app/lab.
                      Standalone (outside the pnpm workspace) — see its
                      README.md and docs/DECISIONS.md 027. Local-only; the
                      real orchestrator (remote host, multi-tenant) is a
                      later Phase 2 session.
```

## Conventions

- Server Components by default; `"use client"` only where interaction
  requires it. Mutations via server actions with zod validation at the
  boundary. Route handlers only for webhooks/auth callbacks.
- Prisma client is a singleton from `packages/db`. Schema changes go through
  `prisma migrate dev` with a named migration — never `db push` on shared DBs.
- Content is code: lessons (MDX), taxonomy, checklists, and drill cards live
  in `packages/content` and sync to DB via an idempotent seed/sync script.
  DB rows are an index of content, never the source of truth for it.
- Pure logic gets unit tests (Vitest): FSRS scheduling wrappers, checklist
  fork/diff, taxonomy sync, (later) check evaluation. UI gets tested by use,
  not snapshots, for now.
- No `any`. Errors: throw typed errors in actions, render them as designed
  error states — never a raw stack trace or a silent failure.
- Naming: skill node IDs are dotted lowercase (`linux.pam.pwquality`);
  DB models singular PascalCase; files kebab-case.

## Design

`DESIGN.md` is binding. Three rules worth repeating here:
- Green (`--score`) and red (`--penalty`) are reserved exclusively for
  scoring semantics. Never decorative.
- `tabular-nums` on every number that can change or align.
- Lucide icons only, one stroke weight. No emoji in UI.

Every user-facing screen must pass `DESIGN.md`'s Screen craft checklist
before a session ends.

## Do not build yet (deferred by decision)

Redis/queues · R2/object storage · session recordings · Prometheus/Grafana ·
Terraform/Ansible · school organizations layer · mentor/alumni role ·
Discord bridge · season ladder · AI tutor · placement micro-task (needs lab
infra) · desktop (noVNC) streaming · separate API service · assignments and
coach dashboard (Phase 3) · anything Windows-agent related (Phase 4).

## Commands

```
pnpm dev           # run apps/web
pnpm build         # build all workspaces
pnpm test          # vitest across packages
pnpm db:migrate    # prisma migrate dev (from packages/db)
pnpm db:seed       # sync packages/content into DB (idempotent)
pnpm lint          # eslint + tsc --noEmit
```

## Workflow

Plan mode first for any multi-file change. Small, focused commits with
imperative messages. After any decision that contradicts or extends this
file, the spec, or the roadmap: append an entry to `docs/DECISIONS.md` in
the same PR. Keep this file current — it is the contract between sessions.
