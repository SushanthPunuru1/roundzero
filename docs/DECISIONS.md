# Decisions log (ADR-lite)

Format: number · date · decision · why · consequence. Newest at bottom.
Any change that contradicts `CLAUDE.md`, `DESIGN.md`, or the roadmap gets
an entry in the same PR.

---

**001 · 2026-07 · Terminal-first labs; desktop streaming deferred.**
Linux CyberPatriot work is ~95% CLI and principle #1 is Chromebook-first.
xterm.js/ttyd sessions cut per-session RAM/bandwidth ~10x, remove desktop
image maintenance, and speed cold starts. noVNC desktops revisit post-season.

**002 · 2026-07 · Single Next.js app; no separate API service in Phase 1.**
Server actions + route handlers on Vercel cover all Phase 1 surface. The
Phase 2 orchestrator becomes the first separate service because it must run
on the lab box. Avoids double deploys/costs now. Consequence: keep domain
logic in importable modules so extraction stays cheap.

**003 · 2026-07 · Agent + injector in Go; everything else TypeScript.**
Static binary drops into any lab container with zero runtime deps; the same
codebase cross-compiles to the Phase 4 Windows local agent. aeacus's YAML
check format is the design reference (clean-room implementation, no code
reuse — license separation).

**004 · 2026-07 · Better Auth (Google + magic link via Resend), organization
plugin; one organization == one team.** Ships teams, roles, and invitations
nearly out of the box. Join-by-code implemented on top (code column on the
team). "Student belongs to ≤ 1 team" enforced in app logic. School-level
organizations deferred; will layer above teams later.

**005 · 2026-07 · ts-fsrs for spaced repetition, not hand-rolled SM-2.**
Better retention math, maintained library, pure logic we can unit-test.

**006 · 2026-07 · Canonical skill taxonomy as the data spine.**
`packages/content/taxonomy/taxonomy.yaml` with stable dotted IDs
(`linux.pam.pwquality`). Lessons, checklist items, drill cards, vuln
templates, debrief lines, and mastery all reference node IDs. IDs are never
renamed — deprecate and add. DB holds a synced index; YAML is truth.

**007 · 2026-07 · Content-as-code.** Lessons (MDX), checklists, drill
cards, taxonomy live in `packages/content`, synced to DB by an idempotent
script. Enables community PRs later and keeps DB rebuildable.

**008 · 2026-07 · Design direction: precision instrument.** Dark-first,
deep neutral base, signal-amber accent, mono as brand material. Green/red
reserved exclusively for scoring semantics. Full system in `DESIGN.md`.
Rejected: hacker green-on-black (cliché, hurts coach trust), default
shadcn look (drift).

**009 · 2026-07 · Deferred list.** Redis, R2, Grafana/Prometheus,
Terraform/Ansible, school orgs, mentor role, Discord, season ladder, AI
tutor, placement micro-task, desktop streaming — all deliberately parked
until something forces them. Rationale: solo builder, season deadline,
free-tier budget.

**010 · 2026-07 · Product renamed CyberRange → RoundZero.** Working
title replaced everywhere it appeared (`CLAUDE.md`, `DESIGN.md`,
`docs/ROADMAP.md`, `docs/spec.md`, schema/taxonomy header comments). No
functional change.

**011 · 2026-07 · Monorepo scaffolded: pnpm workspaces, no Turborepo
yet.** `apps/web` (Next.js 16 App Router, TS strict), `packages/{db,ui,
content}`. Root scripts shell out via `pnpm --filter`/`pnpm -r`; a build
orchestrator (Turborepo/Nx) is unnecessary at this package count and
adds config surface — revisit if build graph complexity grows.
Tailwind v4 config is CSS-first (`@theme` in `globals.css`), no
`tailwind.config.js`. shadcn/ui wired in monorepo mode: `components.json`
lives in `packages/ui` (the single target for generated primitives, per
`CLAUDE.md` rule 3); `apps/web` consumes it via `transpilePackages`.
Only `Button` built this session as a wiring proof — the rest of the
`packages/ui` v1 inventory (`DESIGN.md`) lands with the milestone work
that needs it. Prisma pinned to `6.19.2` (not the newly-`latest` 7.x)
to match the already-committed `schema.prisma`'s `prisma-client-js`
generator without forcing a schema rewrite mid-scaffold. ESLint 9 flat
config at the root plus Next's own generated config in `apps/web`
(pinned at 9, not the newly-`latest` 10 — `eslint-plugin-react`, pulled
in by `eslint-config-next`, throws on ESLint 10's runtime API as of
this writing);
Vitest per-package, proven with one smoke test in `packages/db`. CI
(`.github/workflows/ci.yml`) runs `prisma generate`/lint/test/build only
— no `prisma migrate dev` against the real Neon DB, in CI or during
scaffolding, since that's a live shared resource and creating the
initial migration belongs with next session's auth/teams work.

**012 · 2026-07 · Switzer/IBM Plex Mono not yet self-hosted.**
`globals.css` wires the `--font-sans`/`--font-mono` token names to
system-font fallback stacks with a TODO. Fetching and licensing the
actual Fontshare/IBM Plex Mono font files is follow-up work, not
something to fetch from a third-party CDN unattended during scaffolding.
