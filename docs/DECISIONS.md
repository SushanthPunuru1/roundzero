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
