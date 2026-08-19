# RoundZero — Roadmap

Sequencing rule: each phase gate must pass before the next phase starts.
The external deadline that matters is the CyberPatriot season — Round 1
lands ~early-to-mid November. Phase 1 must be live for our own club by
late September; Linux labs by early November. August assumes reduced hours
(SAT retake); September coexists with EA essays.

## Scope: RoundZero is an individual training platform

**The unit is one person training and improving.** Not a team, not a class,
not a club. Every feature from here optimizes for a single learner: their
placement, their track, their progress, their practice.

**Coach tools are cut entirely.** Assignments, the coach dashboard,
scrimmages, the team coverage matrix, readiness reports for a group, and the
coach setup wizard are removed from this roadmap — not deferred. Do not
propose them. Phase 3 as originally specced no longer exists.

**Teams are dormant, not deleted.** `Organization`, `Member`, `Invitation`,
join codes, `/app/team` and the roster stay in the codebase and keep working.
Build nothing further on them. They are not removed because `Organization` is
Better Auth's model, created by the `organization` plugin wired into
`auth.ts` and locked by DECISIONS 004 — removing it is an auth-layer change
on working sign-in for zero user gain. `TeamChecklist` is also scoped by
`organizationId`, so removal would mean re-scoping and re-migrating the
shipped fork/diff/print trio. A "team checklist fork" and "my customized
checklist" are the same feature with a different owner column; that rename
can happen cheaply later if it ever matters.

**Machine specialization lives on placement, never on the team model.**
"I'm focusing on Linux" is core to the track generator, and `Placement.focus`
already carries it — user-scoped, no membership required. `Member.machineRole`
goes dormant with the rest of teams. Verified: `loadTrack` reads
`normalizeFocus(placement?.focus)` and nothing in `lib/track.ts` or
`track/generate.ts` references `machineRole` or `prisma.member`. A learner
with no team must never be unable to express focus, and today they can't be
— `normalizeFocus` falls back to all machines when placement is absent. Do
not reintroduce a membership dependency into focus resolution.

## Locked build order

This supersedes the phase-gate sequencing and the calendar map below, both
of which are kept for reference. Decided deliberately; not up for
re-litigation each session.

### 1. Everything user-facing — content AND unfinished functionality

In this order:

1. ~~Linux lesson set~~ — done
2. ~~Checklist trio — fork UI, diff view against upstream, print/PDF
   export~~ — done
3. ~~Remaining lesson sets — Forensics, Scripting, Meta-skills~~ — done
   (53 lessons, all 7 taxonomy domains)
4. ~~Coach setup wizard~~ — **CUT.** Out of scope under individual-first.
   The implementation was reverted deliberately, not lost.
5. Content-depth pass to fatten every bank ← current

Functionality sits inside this step rather than after it because the design
pass cannot run on screens that do not exist.

### 2. Infrastructure — the hosting launch

Server, orchestrator, gVisor isolation, egress lockdown, pooling, teardown
— so the lab runs for someone other than the author.

### 3. Full design pass — the whole app at once

**Prerequisite, and the first task of this step: self-host Switzer and IBM
Plex Mono.** `DESIGN.md` specifies both; `globals.css` still carries a TODO
and falls back to `ui-sans-serif` / `ui-monospace` system stacks. Every
screen critiqued so far has been rendering the fallback, so any typography
tuning done before the real faces land is tuning the wrong thing. Fonts
first, then everything else.

Input for the rest of the pass is `docs/DESIGN_GRIPES.md`, not taste.

### 4. Onboarding real learners

Only after 3. Individual learners, one at a time — not a club rollout, not a
class. The unit here is the same as everywhere else: one person.

**Nobody uses this app — including the author's own club — until the design
pass is done.** Early user testing and soft launches have been considered
and rejected. Do not propose them. The reason the design pass comes after
content is that designing around placeholder or absent content produces
screens that break the moment real content lands; the reason onboarding
comes after design is that a first impression is spent once.

Consequence for every session in steps 1 and 2: screens may ship visually
rough. They may NOT ship with hand-rolled primitives — see `CLAUDE.md`
golden rule 3. Rough-but-composed is cheap to fix in step 3; hand-rolled is
not.

## Calendar map

Superseded by the locked build order above; retained for reference.

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
- [x] Windows depth build — `docs/WINDOWS_DEPTH_SPEC.md`: 9 Windows lessons
      (account/password policy incl. the `net accounts`-can't-do-complexity
      trap, users/groups, local policy/UAC/registry classics, SMB/RDP,
      services, persistence/malware, Defender/firewall/updates, shares/files/
      hosts, and a Windows Server basics lesson) plus 16 new drill cards
      (30 Windows cards total), closing the last knowledge-pillar gap —
      Windows now has lessons + drills alongside Linux/Cisco/Forensics. Pure
      web content, no code changes needed (seed/lessons-index/file-tracing
      were already domain-generic) — see DECISIONS 035.

### Milestone 3 — SRS + daily drill (August–early Sept)

- [x] Drill cards (concept + command) authored per skill node in content
- [x] ts-fsrs scheduling: per-user card states, review log; unit-tested
- [x] Daily drill surface: ~5 minutes of due cards; streak tracking
- [x] Lesson completion enqueues that lesson's cards

### Milestone 4 — Onboarding + club launch (September)

- [x] Foundations content expansion — `docs/ONBOARDING_PATH_SPEC.md` Part D:
      6 new Foundations-level lessons (what an OS is, users/permissions,
      services, ports, passwords/policy, what hardening means) at the
      previously-empty `foundations.core.*` taxonomy nodes, plus 12 new
      drill cards. Closes the beginner on-ramp gap Part A's placement now
      routes into.
- [x] Placement quiz — Part A: self-report (2 questions) + a 12-question
      adaptive knowledge check (foundations/linux/windows/networking, 3
      each) → per-domain `TrackLevel` at `/app/placement`, skippable,
      re-takeable, non-punishing (micro-task deferred until labs exist, per
      the original scope note).
- [x] Recommended track + dashboard — `docs/ONBOARDING_PATH_SPEC.md` Parts B
      (the pure, heavily-unit-tested track generator: placement + progress +
      taxonomy → an ordered queue of typed next-steps, derived on read) and C
      (the `/app` dashboard: "Next up," a "Today" block, cross-pillar progress,
      a warm non-blocking placement invite, and inline "Next up" after every
      lesson/quiz/drill/lab). See DECISIONS 037.
- [ ] Coach setup wizard: create team → invite → cadence → season plan
      generated from `Season` calendar data
- [x] First-session guided path for new students (Part C above: the dashboard
      is now the post-sign-in landing and removes the "what do I do?" decision)
- [ ] Empty/loading/error states audited across every page
- **Phase 1 gate (deferred to step 4 of the locked order):** own club
  completes Windows + Linux knowledge tracks; ≥ 80% weekly return over
  3 weeks.

## Phase 2 — Linux live labs (October → early November)

Orchestrator service (warm pool, seed, lifecycle, teardown) on one Hetzner
box · Docker + gVisor isolation, default-deny egress (gVisor is
non-negotiable before any external user) · Go agent: YAML check evaluation,
30–60s polling, WebSocket score deltas · injector + 5 seeded template packs
from spec Appendix A · terminal-only sessions (xterm.js/ttyd) — desktops
deferred · generated README per instance · debrief page with ScoreLine list;
missed items auto-enqueue to SRS.
**Gate (evaluated after the design pass, not before it — see locked build
order above):** 25 external users complete a lab; cold start < 20s; zero
isolation incidents.

## Phase 3+ (pointers only)

Phase 3 coach layer (dashboard, assignments, heatmap, scrimmages, readiness
PDF, playbooks) · Phase 4 Windows local agent (same Go codebase,
cross-compiled) · Phase 6 community library + post-round debriefs with
integrity lockouts · Phase 7 scale, session replay, AI tutor. Details live in
`docs/spec.md` §19. (The Cisco pillar — `docs/CISCO_BUILD_SPEC.md` Parts A/B/C
— shipped in full as Milestone 2 parallel tracks; no Phase 5 slot remains for
it.)
