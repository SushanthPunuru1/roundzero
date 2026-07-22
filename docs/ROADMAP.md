# RoundZero — Roadmap

Sequencing rule: each phase gate must pass before the next phase starts.
The external deadline that matters is the CyberPatriot season — Round 1
lands ~early-to-mid November. Phase 1 must be live for our own club by
late September; Linux labs by early November. August assumes reduced hours
(SAT retake); September coexists with EA essays.

## Calendar map

| Window | Build | Gate |
|---|---|---|
| Jul (now–31) | Milestone 1: repo, auth, teams, taxonomy, lessons | Deployed; club officers can sign in |
| Aug | M2 checklists · M3 SRS/daily drill (interruptible work) | Systems work end-to-end with real content |
| Sep | M4 onboarding + polish; onboard the club | Club uses it weekly for 3 weeks (spec gate) |
| Oct – early Nov | Phase 2: orchestrator, Go agent, 5 Linux packs, debrief | Club runs labs before Round 1; cold start < 20s |
| Dec – Feb | Phase 3: coach dashboard, scrimmages, heatmap, readiness PDF | External coach runs a scrimmage unassisted |
| Post-season | Phase 4+ Windows bridge · Cisco · community · desktops | Per spec §19 |

## Phase 1 milestones

### Milestone 1 — Skeleton with a pulse (target: end of July)

- [ ] Monorepo scaffolded per `CLAUDE.md` layout; CI green; deployed on
      Vercel with PR previews
- [ ] `DESIGN.md` tokens wired into Tailwind theme; `packages/ui` v1
      primitives built (at minimum: Button, Card, Input, Badge, PageHeader,
      EmptyState, DataTable, ScoreLine)
- [x] Better Auth live: Google + magic link sign-in; platform roles
      (student / coach / admin)
- [x] Coach creates a team (division tag) → join code works → student
      joins → roster page shows members and machine roles (Windows /
      Linux / Cisco), captain flag settable
- [x] `taxonomy.yaml` seeded to DB via idempotent sync script
- [x] MDX lesson pipeline: three real Foundations lessons render with an
      end-of-lesson interactive check; completion recorded
- **Done when:** a club officer signs in on a school Chromebook, joins the
  team, and completes a lesson on the production URL.

### Milestone 2 — Checklists (August)

- [x] Canonical Windows + Linux checklists authored in
      `packages/content` (every item: action, why, per-OS commands,
      skill-node ID, lesson link)
- [ ] Team fork: customize items, add items, reorder
- [ ] Diff view against upstream canonical version
- [ ] Print/PDF export formatted for round day (this is load-bearing —
      teams may use printed references in competition)
- [x] Forensics question bank — Part A of `docs/FORENSICS_BUILD_SPEC.md`:
      ~24 self-contained CyberPatriot-style forensics questions across all 8
      archetypes at `/app/forensics`, graded as normalized exact strings,
      missed questions enqueue to the SRS drill. Part B (the gradable
      `forensics-practice` scenario box) extends the Phase 2 agent/lab
      engine and is a later session.
- [x] Networking/Cisco pillar Parts A + C — `docs/CISCO_BUILD_SPEC.md`: 9
      networking lessons, a 35-question networking quiz at `/app/networking`
      (built on a quiz engine generalized out of the forensics quiz UI/
      grading, now shared by both), and 27 IOS command/concept drill cards.
      Pure content, parallel to the Phase 2 milestone above it, same as
      forensics Part A was.
- [x] Networking/Cisco pillar Part B — the subnetting trainer at
      `/app/subnetting`: a provably-correct pure subnet-math module + a
      seedable generative problem engine (CIDR/mask breakdown, VLSM fit,
      which-subnet), per-field answer checking, and an instant worked binary
      solution. Quick round (5) and endless practice modes, optional timer,
      best quick-round accuracy persisted (reusing `QuizProgress`). Pure web
      content, no lab infra — see DECISIONS 034.

### Milestone 3 — SRS + daily drill (August–early Sept)

- [x] Drill cards (concept + command) authored per skill node in content
- [x] ts-fsrs scheduling: per-user card states, review log; unit-tested
- [x] Daily drill surface: ~5 minutes of due cards; streak tracking
- [x] Lesson completion enqueues that lesson's cards

### Milestone 4 — Onboarding + club launch (September)

- [ ] Placement quiz: ~12 adaptive questions → recommended track per
      domain (micro-task deferred until labs exist)
- [ ] Coach setup wizard: create team → invite → cadence → season plan
      generated from `Season` calendar data
- [ ] First-session guided path for new students
- [ ] Empty/loading/error states audited across every page
- **Phase 1 gate:** own club completes Windows + Linux knowledge tracks;
  ≥ 80% weekly return over 3 weeks.

## Phase 2 — Linux live labs (October → early November)

Orchestrator service (warm pool, seed, lifecycle, teardown) on one Hetzner
box · Docker + gVisor isolation, default-deny egress (gVisor is
non-negotiable before any external user) · Go agent: YAML check evaluation,
30–60s polling, WebSocket score deltas · injector + 5 seeded template packs
from spec Appendix A · terminal-only sessions (xterm.js/ttyd) — desktops
deferred · generated README per instance · debrief page with ScoreLine list;
missed items auto-enqueue to SRS.
**Gate:** 25 external users complete a lab; cold start < 20s; zero
isolation incidents.

## Phase 3+ (pointers only)

Phase 3 coach layer (dashboard, assignments, heatmap, scrimmages, readiness
PDF, playbooks) · Phase 4 Windows local agent (same Go codebase,
cross-compiled) · Phase 6 community library + post-round debriefs with
integrity lockouts · Phase 7 scale, session replay, AI tutor. Details live in
`docs/spec.md` §19. (The Cisco pillar — `docs/CISCO_BUILD_SPEC.md` Parts A/B/C
— shipped in full as Milestone 2 parallel tracks; no Phase 5 slot remains for
it.)
