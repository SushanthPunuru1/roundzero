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

**013 · 2026-07 · Design exploration verdict. Precision-instrument
hypothesis VALIDATED — all strong outputs stayed inside DESIGN.md
tokens. Adopted: (a) 2a 'flight recorder' as the Phase 2 debrief-page
target: run-trajectory chart (points over elapsed time, penalty drops,
critical-service outage bands), timestamped event log, gauge strip
incl. critical-service uptime %, seed shown in header. Chart is
enhancement only — the event log is the at-rest source of truth; all
chart/log interactions require keyboard parity. Phase 2 data
requirement: persist per-check timestamps and critical-service uptime.
(b) 1b 'field datasheet' (warm light assessment-record) as the
PRINT-SURFACE identity for checklist export and readiness PDF.
Reference:
https://claude.ai/design/p/c6ee9605-07d1-4b6d-95a8-24980f330972?file=Debrief+directions.dc.html&via=share

**014 · 2026-07 · Better Auth wired live: pinned dependency versions +
magic-link sender.** `better-auth@1.6.23`, `@better-auth/cli@1.4.21` (dev
dep, used one-off for schema generation, not a persistent script),
`resend@6.17.2`, `zod@4.4.3`. Extends 004 (Google + magic link via Resend,
organization plugin, one org == one team) with concrete versions. Magic-link
sender is `onboarding@resend.dev` (Resend's shared dev sender) for now —
it only delivers to the Resend account owner, which is enough to prove the
flow end to end; swap for a verified domain sender before onboarding real
users. `user`/`organization`/`member` APP FIELDS (see schema.prisma) are
declared as Better Auth `additionalFields` with `input: false` so they can
never be set through the public auth API — they stay system/coach-owned.
Reconciled the hand-written Prisma schema against `@better-auth/cli
generate` output (run against a scratch file, never applied directly): the
generator agreed with every hand-written model and APP FIELD; the only
real delta was a missing `@@index([identifier])` on `Verification`, now
added. First migration (`init_auth`) applied to the dev Neon DB.

**015 · 2026-07 · `dotenv-cli` added to load the root `.env` for local-only,
DB/env-dependent scripts.** Next.js and the Prisma CLI only read `.env`
files from their own package directory, not a monorepo root, so
`apps/web`'s `dev` script and `packages/db`'s `migrate`/`seed` scripts
couldn't see the root `.env` (`prisma validate` failed with "Environment
variable not found" before this). Wrapped only those three scripts with
`dotenv -e ../../.env --`; deliberately left `generate` (packages/db) and
`build`/`test` (apps/web) untouched since CI invokes them with real env
vars injected directly, not a `.env` file, and requiring one would break
CI. Root `.env` stays the single source of truth — no duplicated secrets.

**016 · 2026-07 · Team create/join/roster built as Prisma-direct server
actions, not the organization plugin's REST endpoints.** Extends 004.
The plugin's default RBAC (owner/admin/member) and invitation flow don't
match our coach/captain/member roles or join-by-code UX, and 004 already
scoped join-by-code and the one-team-per-user rule as app logic on top of
the plugin's schema — so `createTeam`/`joinTeam`/roster-management actions
write `Organization`/`Member` via Prisma directly, gated by
`auth.api.getSession` + a hand-rolled permission check
(`apps/web/src/lib/teams.ts`), instead of `auth.api.createOrganization` /
`addMember`. `auth.ts` is untouched. A user's team is resolved by
`Member.userId` (at most one row, per 004), so `Session.activeOrganizationId`
stays unused this milestone — revisit if we ever need multi-team switching.
No new dependency: the machine-role/division pickers are a tokenized native
`<select>` (`packages/ui` `Select`) and member removal uses an inline
two-step confirm, both avoiding Radix Select/Dialog. Added to
`packages/ui`: `Card`, `Badge`, `Select`, `PageHeader` (DESIGN.md v1
inventory, tokenized, no new colors). `packages/db` now re-exports the
`Division`/`MachineRole` Prisma enums so `apps/web` doesn't need its own
`@prisma/client` dependency just for types.

**017 · 2026-07 · Three bugs fixed post-016: roster machine-role revert,
magic-link always-invalid, Google sign-in dropping the account name.**

*Machine-role revert.* The DB write always succeeded (confirmed by querying
Postgres directly after the action); the select just visually snapped back.
Root cause was two-layered: react-dom calls `requestFormReset` as part of
submitting any `<form action={fn}>` (`startHostTransition` in
react-dom-client), which does a native `HTMLFormElement.reset()` — that
resets *every* control in the form back to its HTML-declared default
(first `<option>`, here "Unassigned") regardless of React's `value` prop,
because it bypasses React's reconciliation entirely. Making the `<select>`
controlled alone didn't fix it (verified: still reverted) since React only
re-writes a controlled value when its own `value` prop differs from the
prior *render*, and the native reset happens outside that diff. Fix: the
machine-role control no longer renders a `<form action={fn}>` submitted via
`requestSubmit()` — it calls the `useActionState` dispatch function directly
from `onChange` (wrapped in `startTransition`, since the dispatch isn't
auto-transitioned outside a form/button `action` prop), which never invokes
`startHostTransition`'s reset path. Promote/remove kept their `<form>`s —
their only field is a `value`-controlled hidden input, immune to this.
Added `apps/web/src/app/app/team/roster-table.test.tsx`
(`@testing-library/react` + `jsdom`, new devDependencies — free/MIT, no
Next-specific test runner existed for component-level React behavior)
asserting the select keeps a newly-chosen value after the mocked action
resolves; confirmed it fails against the pre-fix code before restoring the
fix, so it's a real regression guard.

*Magic link always `INVALID_TOKEN`.* The email pointed straight at the
API's GET verify endpoint, which consumes the (single-use) token on the
first request to it — email clients and corporate gateways routinely
prefetch/scan links before the user clicks, consuming it first. Fixed by
routing the email link at a new app page (`/magic-link`) instead; the
token-consuming fetch now happens from client-side JS on user page-load
(`magic-link-confirm.tsx`), which scanners generally don't execute. Verified
directly: a plain `curl` GET against the new link left the token unconsumed
in `Verification`; a real (JS-executing) browser hit afterward still signed
in successfully. The confirm page omits `callbackURL` on its own verify
call specifically because Better Auth returns JSON instead of redirecting
when it's absent (`callback.mjs`) — that's what lets success/failure be
told apart from `fetch` without following/parsing a redirect. Guarded with
a `useRef` against React Strict Mode's dev double-invoke of effects, which
would otherwise burn the token on the throwaway first pass.
`buildMagicLinkConfirmUrl` (`auth-helpers.ts`) is unit-tested.

**018 · 2026-07 · `yaml` (eemeli, MIT) added to `packages/db`, pinned to
`2.9.0`.** Needed to parse `packages/content/taxonomy/taxonomy.yaml` for the
taxonomy sync script (`prisma/seed.ts`, wired to `pnpm db:seed`), which
replaces the seed stub left in place during scaffolding (011). Ships its own
TS types, so no `@types` package. Parsing and validation
(`src/taxonomy/parse.ts`: dotted-id format, no duplicate ids, parent-prefix
consistency, skill `level` required/valid) and the create/update/deprecate
diff against existing rows (`src/taxonomy/reconcile.ts`) are pure functions,
unit-tested without touching the DB; `prisma/seed.ts` is the thin glue that
reads the file, calls both, and applies the plan in a transaction (creates
ordered DOMAIN → CATEGORY → SKILL so the self-referential `parentId` FK is
always satisfied). No `zod`: the cross-reference checks here are custom logic
either way, and hand-rolled `TaxonomyError` messages keep `packages/db`
dependency-light. Per DECISIONS 006, a `SkillNode` id absent from the YAML is
marked `deprecated: true`, never deleted; a deprecated id that reappears is
un-deprecated. Verified against the dev Neon DB: first run created all 108
rows (7 domains + 22 categories + 79 skills, matching the file); a second run
reported all 108 as unchanged, proving idempotency.

*Google sign-in showing email instead of name.* Confirmed in the dev DB:
the account had `providers: ["google"]` but `name: ""`. Better Auth only
writes `name`/`image` from a social profile at first user creation
(`handleOAuthUserInfo`); an existing user (e.g. one first created nameless
via magic link) never gets it backfilled on a later Google sign-in unless
`overrideUserInfoOnSignIn: true` is set on the provider — added to
`socialProviders.google` in `auth.ts`. Self-heals on next Google sign-in;
not independently unit-tested (would require mocking Better Auth's OAuth
callback flow, out of proportion to a one-line config fix) — verified by
source tracing (`@better-auth/core` `google.ts` / `link-account.mjs`)
since real Google OAuth can't be driven headlessly here.

**019 · 2026-07 · Visual craft pass: persistent app shell + screen-craft
checklist codified.** Every `/app` page used to build its own chrome (a
repeated eyebrow + sign-out button) with no shared frame or max-width. Added
`apps/web/src/app/app/layout.tsx` (session check + `TopBar`, ~1100px centered
container) as the single shell for all `/app` routes; `TopBar`
(`app/top-bar.tsx`) carries the wordmark, a path-derived breadcrumb, and
account controls, with room left for a future ⌘K search (not built). New
`packages/ui` primitives, tokenized, no new colors: `Avatar` (deterministic
initials, `--surface-2`/`--hairline`, never a hashed color) and
`StatStrip`/`Stat` (the DECISIONS 013 gauge-strip style: eyebrow label over a
mono `tabular-nums` value). `/app/team` gained a stat strip (members, roles
filled, division) and an n=1 "invite panel" moment instead of a one-row
table; roster rows got avatars, a hover surface step, and an em dash instead
of a blank Actions cell. Codified the standard as a "Screen craft checklist"
appended to `DESIGN.md`, referenced from `CLAUDE.md`'s Design section so
future sessions are gated on it. No server action, auth, or Prisma schema
changes; no new dependency. Verified with Playwright screenshots (browser
fetched ephemerally via `npx`, not added to any `package.json`) of the public
landing/sign-in routes plus a temporary, uncommitted preview route exercising
the same prop-driven components the real `/app`/`/app/team` pages compose
(those pages are session-gated server components, so Playwright can't
navigate to them directly without a seeded session).

**020 · 2026-07 · MDX lesson pipeline: `next-mdx-remote`, lesson sync, and
check-grading design.** Milestone 1's final item. Added
`next-mdx-remote@6.0.0` (new dependency) — its `/rsc` export compiles MDX to
React inside a Server Component at request time, which we need since a
lesson is read as data by slug rather than statically imported the way
`@next/mdx` expects; peer `react >=16`, built on `@mdx-js/mdx@3`, no
syntax-highlighting plugin added (commands are short shell lines styled in
mono via a component map, kept the dep surface minimal). `packages/db/src/lessons/`
mirrors the taxonomy module (`parse` / `grade` / `reconcile`, pure and
unit-tested): frontmatter is validated against the `packages/content/lessons/README.md`
contract and `validateSkillRefs` fails the whole seed run loudly if a
lesson's `domainId` or any `skills[]` id isn't a real taxonomy node — the
spine (CLAUDE.md rule 2) must hold for lessons too. `prisma/seed.ts` now
syncs `Lesson`/`LessonSkill` the same idempotent way as `SkillNode`, after
taxonomy sync so skill refs can be validated against the just-synced set.
Deliberately no `check` column on `Lesson`: check questions live only in
MDX frontmatter and are re-read + re-parsed server-side on every grading
submission, so the answer key never ships to the client — `apps/web`'s
`LessonCheck` client component only ever receives `{ q, options }`, and the
`submitCheck` server action returns per-question correct/incorrect + `why`,
never which option was correct. Retakes are unlimited; `LessonProgress.checkScore`
keeps the best attempt (`bestScore` in `packages/db/src/lessons/grade.ts`).
Lesson MDX is read from `packages/content` at request time via `node:fs`
(same content-stays-out-of-apps/web rule as the taxonomy YAML), so
`next.config.ts` gained `outputFileTracingRoot` (monorepo root) and
`outputFileTracingIncludes` pinning `packages/content/lessons/**/*.mdx` into
the Vercel function bundle for the `/app/lessons` routes — unverified on
Vercel itself (no deploy access from this session), but confirmed locally: a
production `next build` (with env loaded) compiles both routes and a
standalone `compileMDX` smoke test against all three lesson bodies produces
the expected heading/code-block counts. All three Foundations lessons
(`reading-a-readme`, `scoring-engine`, `safe-change-discipline`) flipped to
`published: true` — editorial sign-off given. Verified end to end: `pnpm
db:seed` created all three lessons on first run and reported all-unchanged
on a second run; temporarily pointing a skill ref at a nonexistent id made
the seed fail loudly with exit code 1, as required, then reverted; a
disposable-user integration script exercised the exact `LessonProgress`
upsert the server action performs and confirmed retakes never lower the
saved score. Full interactive browser click-through (open a lesson, answer
the check, see the score persist across refresh) was not done in this
session — no browser automation tool was available, and creating a real
session requires either a live magic-link email round-trip or dumping
session tokens from the DB, which this session's sandboxing correctly
refused as credential materialization. A human should do one manual
click-through before relying on this in production.

**021 · 2026-07 · Deploy prep: fixed the 020 follow-up build bug, added
postinstall `prisma generate`.** Root cause of "plain `pnpm build` fails
locally on missing `RESEND_API_KEY`": `apps/web/src/lib/auth.ts`
constructed `new Resend(process.env.RESEND_API_KEY)` at module scope: the
`Resend` constructor throws synchronously when the key is falsy, and
`auth.ts` is imported (module-evaluated, not just type-imported) by every
route that touches auth, so `next build`'s page-data collection crashed
building `/api/auth/[...all]` — confirmed by reproducing the exact
stack trace with no env vars set. Fixed by constructing `Resend` inside
the `sendMagicLink` callback instead (request-time, only runs when an
email actually sends), matching the lazy-read approach `CLAUDE.md`
prescribes; no dotenv wrapper needed since the real fix removes the
import-time read. The other `auth.ts` env reads (`BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, Google client id/secret) stay at module scope —
Better Auth only logs a warning/catches internally for those when unset,
it doesn't throw, so build-time collection survives; verified by building
with zero env vars set (exit 0, only warnings). Also added a `postinstall`
script (`prisma generate`) to `packages/db/package.json` so a fresh
install — Vercel or CI — always produces a client, instead of relying on
`build`/`generate` being invoked first; `prisma`/`@prisma/client` builds
were already allow-listed in `pnpm-workspace.yaml`; confirmed by installing
after Prisma reported "Lockfile is up to date" and still needing zero
manual steps: `packages/db postinstall$ prisma generate` ran automatically.
Verified end to end the way Vercel actually builds: ran `pnpm build`
(root, which chains `db generate` then `next build`) with all six env
vars injected directly into the process environment (not the app's own
dotenv), and separately with none set at all — both exit 0. `pnpm lint`
and `pnpm test` (88 tests across `packages/db`/`apps/web`) also pass. No
production validation was weakened — this only changed when a value is
read, not whether it's required at runtime.

**022 · 2026-07 · Milestone 2: checklist + Season sync, read-only render.**
Synced the two already-authored canonical checklists (`packages/content/
checklists/{linux,windows}-core.yaml`, 47 items total) into `ChecklistTemplate`/
`ChecklistItem` and rendered them. Extends 006/007/018/020 — same pattern:
`packages/db/src/checklists/{parse,reconcile}.ts` pure and unit-tested,
`prisma/seed.ts` the thin glue, syncing after taxonomy + lessons so
`skillNodeId`/`lessonSlug` refs validate against the just-synced sets.

*Schema.* `ChecklistItem` gained `caution String?` via an additive migration
(`add_checklist_item_caution`) — the content contract already specified an
optional caution field (none of the 47 items use it yet) but the column
didn't exist. Season `cp-19` ("CyberPatriot XIX") is seeded as a minimal row
(`syncSeason()`, upsert) so the templates' FK resolves; `SeasonEvent` rows
(Appendix B calendar) wait for Milestone 4 coach planning.

*Removed items are deleted, not soft-hidden.* Unlike `SkillNode` (deprecate,
never delete — 006), a `ChecklistItem` whose id drops out of the YAML is
deleted outright. `ChecklistItem` has no soft-hide column, and canonical
items carry no user data yet — team forks (`TeamChecklistItem`, not built
until next session) are separate rows, so nothing downstream references a
canonical item by FK. Content-as-code means the DB is a rebuildable index;
the lesson sync sets the same precedent (020).

*jsonb key order.* Postgres jsonb does not preserve object key order, so
`commands` equality in `reconcile.ts` compares key/value pairs
(`sameCommands`), never `JSON.stringify` identity — confirmed against the
real dev DB: a second `db:seed` run reported all 47 items unchanged despite
the round trip through jsonb storage.

*Detail-page sectioning.* Items render in authored `sortOrder` — never
reordered, since the order itself is operational intent (e.g. `login-defs`
deliberately follows the PAM cluster to complete the password-policy arc).
Section headers come from contiguous taxonomy-category runs
(`groupItemsIntoSections`, `apps/web/src/lib/checklists.ts`): a new header on
category change; a header that recurs later reads `"{Category} — continued"`;
a single-item run on its *first* occurrence renders headerless (the item's own
category chip already carries identity) and is skipped by the TOC, but a
single-item *recurrence* still gets the `"— continued"` header since that
signal is the useful one. The sticky mini-TOC (`md:sticky`, collapses to a
stacked block below `md`/768px — real Chromebook viewports run ≥1024px, so
the sticky two-column layout is the normal case) lists only header-bearing
runs.

*One authorized content fix.* `linux-core.yaml`'s `weak-passwords` item
pointed `skillNodeId` at `windows.users-groups.weak-passwords` — a Linux item
referencing a Windows taxonomy node, flagged during this session's ref
validation. Changed to `linux.accounts.passwd-shadow`; this also happens to
join that item into the contiguous Linux Accounts run instead of leaving an
orphan single-item cross-OS section.

No new dependency (`yaml` already in `packages/db` per 018). Verified end to
end against the dev Neon DB: `db:seed` created 2 templates + 47 items; a
second run reported all-unchanged; temporarily pointing an item's
`skillNodeId` at a nonexistent id failed the run with exit 1 and a precise
message, then reverted. `pnpm test` (179 tests across `packages/db`/
`apps/web`) and `pnpm lint` pass. Full interactive verification (both pages,
copy-to-clipboard, section/TOC behavior, focus rings, and no horizontal
overflow at mobile/tablet/Chromebook widths) was done via a temporary,
uncommitted preview route rendering the real prop-driven components against
real seeded data — same approach as 019, deleted before commit since
`/app/checklists*` are session-gated and no browser-automatable session
exists in this sandbox.

**023 · 2026-07 · Fixed Vercel prod build failure: stale cached Prisma
Client survives a no-op install.** `dd5ade6`'s `caution` column (022) built
and typechecked locally but failed on Vercel: `Type error: Property
'caution' does not exist on type ...` in `app/checklists/[id]/page.tsx`.
Root cause: Prisma's default generator output lands inside `node_modules`
(`node_modules/.prisma/client`, no custom `output` path in
`schema.prisma`), which Vercel restores wholesale from its build cache
across deployments. `packages/db`'s `postinstall` (021) only fires when
pnpm actually changes something during install; a cache-restored,
lockfile-unchanged install is a no-op — pnpm logs "Already up to date" and
never re-invokes lifecycle scripts — so the client generated *before* the
`caution` migration survives untouched into a build of a commit that
requires it. Reproduced exactly outside Vercel: cloned the repo to a
scratch dir, `pnpm install` (fresh, postinstall generates a correct
client), regenerated the client against a schema with `caution` stripped
(simulating the pre-migration cached client), restored the real schema,
ran a second `pnpm install` (logged "Already up to date," confirmed no
regeneration), then `next build` with zero env vars in the process
environment (no `.env` file) — reproduced the identical type error at the
identical line. Fix: `apps/web`'s own `build` script now runs
`pnpm --filter @roundzero/db run generate` before `next build`, so
generation is part of the build path itself, not a side effect of
install — this holds regardless of Vercel's install-caching behavior or
whether Vercel invokes the root `pnpm build` chain (021) or `apps/web`'s
script directly (a monorepo project's Root Directory setting can call
either). Confirmed the fix against the same reproduced-stale-client
clone: identical no-op install, then `pnpm run build` regenerated the
client and completed with exit 0. `postinstall` (021) is kept as-is — it
still helps fresh installs and local `pnpm install` — but is no longer
load-bearing for prod builds. The generated client was already fully
covered by the blanket `node_modules` entry in `.gitignore`; since no
`output` override exists in `schema.prisma`, nothing generated is or was
ever tracked in git. Re-verified the 021 dotenv guarantee is still intact
while here: neither `apps/web`'s `build` nor `packages/db`'s `generate`
wraps `dotenv -e ../../.env` (only `dev`/`migrate`/`seed` do, per 015),
so this fix does not reintroduce a hard `.env`-file dependency in the
build path. `pnpm build`/`lint`/`test` all still pass locally.

**024 · 2026-07 · Milestone 3: SRS daily drill.** Wired the 55 drill cards
(`packages/content/cards/core.yaml`) and ts-fsrs scheduling (blessed by 005)
into a `/app/drill` surface. Extends the content-as-code pattern (006/007)
and the pure-parse/reconcile/glue split used by taxonomy/lessons/checklists.

*Card sync — deactivate, never delete.* `packages/db/src/cards/{parse,
reconcile}.ts`, wired into `prisma/seed.ts` after checklist sync. Unlike
checklist items (022, hard-delete, no user data), a `DrillCard` dropped from
the YAML is soft-deactivated (`active: false`) because `UserCardState`/
`ReviewLog` rows reference it and carry a student's review history — this
follows `SkillNode`'s deprecate-never-delete pattern (006) instead. A card
that reappears is reactivated and its content refreshed. `skillNodeId` is
validated against the taxonomy the same way checklist items are (must
resolve to a leaf `SKILL` node).

*ts-fsrs `5.4.1`, added to `packages/db`.* `packages/db/src/srs/schedule.ts`
is a thin, unit-tested wrapper — the scheduling math is never hand-rolled.
Its entire job is mapping between ts-fsrs's snake_case `Card` shape
(`elapsed_days`, `scheduled_days`, `learning_steps`, `last_review`) and
`UserCardState`'s camelCase columns, so nothing outside `packages/db`
imports ts-fsrs directly (`Rating`/`CardState`/`newCardState`/
`scheduleReview` are re-exported from `client.ts`). Probing the library
directly (`fsrs().next(card, now, rating)`) showed it tracks a
`learning_steps` field (position within the learning/relearning step
sequence) that the original schema didn't persist — round-tripping without
it would silently reset a card to the first learning step on every review,
so `UserCardState.learningSteps Int @default(0)` was added alongside
`createdAt DateTime @default(now())` (needed for the daily new-card cap
below) in one additive migration, `add_usercardstate_createdat_and_
learningsteps`.

*New-card introduction, two paths.* (a) Completing a lesson
(`enqueueLessonCards`, called from `submitCheck` in
`apps/web/src/app/app/lessons/[slug]/actions.ts`) enqueues every active card
for that lesson's skill nodes the user doesn't already have a
`UserCardState` for — immediate, not subject to the cap, since it's an
explicit signal and a lesson maps to only a handful of cards. (b) A capped
daily Foundations batch (`DAILY_NEW_CARD_CAP = 10`,
`packages/db/src/srs/day.ts`) tops up new cards from the Foundations domain
whenever the drill loads, so a student with zero completed lessons still has
something to drill. Both paths are idempotent
(`createMany`/`skipDuplicates` against the `(userId, cardId)` unique
constraint) and the selection itself is pure/unit-tested
(`packages/db/src/srs/select.ts`).

*Day boundary: fixed `America/New_York`, not per-user.* No per-user
timezone is stored (data minimization, CLAUDE.md rule 8: no unnecessary
PII). Both the streak and the daily new-card cap need a "local day"
boundary, so `PLATFORM_TIME_ZONE = "America/New_York"` (CyberPatriot is a US
competition) is threaded through as a parameter everywhere day-boundary math
happens, rather than hardcoded inline — swapping in a per-user timezone
later is a config change at each call site, not a data migration. The
streak in particular (`packages/db/src/srs/streak.ts`, `computeStreak`) is
**always derived at read time from raw `ReviewLog.reviewedAt` timestamps**
passed in by the caller — never a stored/cached streak counter — precisely
so that swap stays cheap. **Known edge case:** a west-coast student drilling
late evening can have a review land just past the Eastern-time midnight
boundary from their own perspective and see a streak break unfairly (or,
symmetrically, get day-boundary credit earlier than their own local day
actually turned over). **Revisit trigger:** first sustained non-Eastern user
base — i.e. the Phase 2 external-user gate (spec Phase 2 gate: "25 external
users complete a lab") — not before; the whole point of the parameterized
design above is that this fix is additive when it comes.

*Drill surface.* `/app/drill` (`apps/web/src/app/app/drill/{page,actions}
.tsx`, `drill-session.tsx`): due count + streak in a `StatStrip`, one card
at a time, space to reveal / 1-4 to rate (keyboard-first per CLAUDE.md rule
5), COMMAND backs in mono. Rating buttons deliberately do **not** use
`--score`/`--penalty` (DESIGN.md: scoring-semantics-only) — a drill rating
is a memory-recall signal, not a competition score. Added `EmptyState`
(icon, one sentence, one action) to `packages/ui` — it was already in the
DESIGN.md v1 inventory (Milestone 1, still unbuilt) and is genuinely
reusable, not one-off. `apps/web/src/app/app/layout.tsx` queries a cheap
due-card count for the nav badge on every `/app` page load; the actual
new-card top-up only runs when `/app/drill` itself loads, to avoid a write
on every navigation.

No other new dependency. `pnpm test`/`lint` pass; `pnpm db:seed` run twice
locally confirmed idempotency (create once, all-unchanged second run).

**025 · 2026-07 · Fixed a production bug: `/app/drill` could show "all
caught up" while cards were still genuinely due.** `DrillSession`
(`apps/web/src/app/app/drill/drill-session.tsx`) tracked its position with a
plain `index` against the `queue` prop it received from the server. Rating a
card calls the `rateCard` server action, which calls `revalidatePath("/app/
drill")` — Next.js then automatically re-renders the parent Server
Component (`page.tsx`, which re-runs `loadDrill()`) and passes a freshly
re-fetched, **shrunken** `queue` array back down into the already-mounted
client component on every single rating. Since `index` kept incrementing by
1 per rating while the live array kept shrinking by 1 (the just-rated card
dropping out), the two drifted apart: `queue[index]` silently skipped
ahead, and `done = index >= queue.length` could go true well before every
card the session started with had actually been rated — stranding the
skipped cards as still due. Reproduced deterministically with a React
Testing Library regression test (`drill-session.test.tsx`) that rates one
card, then re-renders the component with a shrunk `queue` prop (simulating
the exact revalidation-driven re-render) — confirmed it fails against the
pre-fix code (jumps straight to "Card 2 of 2" / the wrong card, skipping
one entirely) before restoring the fix.

*Fix.* `DrillSession` now freezes its queue once via `useRef` on mount and
never resyncs from the `queue` prop again — a drill session always works
through the exact batch (due cards + that load's daily top-up, already
combined by `loadDrill` before the queue is returned) it started with,
regardless of how many times the parent re-renders behind it. New cards
introduced by a later top-up surface on the next page load, not
mid-session. `rateCard` now also calls `revalidatePath("/app", "layout")`
(previously only the page) so the nav due-count badge
(`apps/web/src/app/app/layout.tsx`'s `countDueCards`) updates live as the
user rates, instead of only on the next hard navigation — with the client
fix in place this can no longer desync the empty-state check. Verified with
a disposable-user integration script (drain to zero) that `loadDrill`'s
`dueCount`, its `queue.length`, and `countDueCards`'s badge query all agree
at 0 after a full session — confirming the data layer was never the
problem, only the client's index/array desync was.

*Copy/UX: the drill wasn't teaching that it's self-graded recall, not a
quiz.* After reveal, the four rating buttons now show their meaning, not
just their name — "1 Again — Didn't recall it", "2 Hard — Recalled, but it
was a struggle", "3 Good — Recalled it correctly", "4 Easy — Recalled it
instantly" — under a "How well did you know it?" eyebrow, still clickable
and keyboard 1-4. The page intro now states the model directly: "Recall the
answer, reveal it, then rate how well you knew it — you're grading your own
memory, not taking a quiz." No new `--score`/`--penalty` use (still
neutral/accent tokens only, per DESIGN.md). No new dependency.

**026 · 2026-07 · Phase 2 kickoff: agent/ Go module, check-file schema,
merged-config decision, linux-practice vulnerable image.** First Phase 2
build (extends 003's "agent + injector in Go" decision with the concrete
schema/implementation). Everything runs locally against Docker; no
orchestrator, browser terminal, or lab-container lifecycle work yet — those
stay ROADMAP Phase 2 items for later sessions.

*Check-file schema.* One `type` + `params` per check, dispatched through a
`internal/checks` registry (`schema.go`/`registry.go`) — deliberately no
`all:`/`any:` composition; every one of the first 10 planted vulns needs
exactly one condition, and adding real composition ahead of a genuine need
would be exactly the kind of premature abstraction CLAUDE.md warns against.
7 check types shipped (`file_contains`, `file_mode`, `user`, `command`,
`service`, `package`, `sshd_config`), each a registered `Evaluator` over an
`internal/system.System` interface (`ReadFile`/`Mode`/`Run`) with a `Fake`
implementation, so every check type's evaluation logic is pure and
unit-tested without Docker or a Linux box. aeacus's YAML format remains
design-reference only (003) — this schema and its Go implementation are
clean-room.

*Merged-config decision.* The `sshd_config` check type evaluates `sshd -T`
(sshd's own merged/effective config) and never greps the raw file. Ubuntu
puts `Include /etc/ssh/sshd_config.d/*.conf` as literally the first line of
`sshd_config`, and sshd applies first-match-wins per directive, so a
drop-in (the real Ubuntu 24.04 cloud-init pattern) can silently override
anything the main file says — grepping the main file alone would produce
both false negatives (a valid fix landed in the drop-in) and false
positives (main file looks hardened, a drop-in overrides it). The
`linux-practice` image's `ssh-permitrootlogin` check plants exactly this
trap; `agent/scripts/prove.sh` state 4 proves a drop-in-only fix is
credited, and a bonus demo proves a main-file-only edit is correctly still
failing.

*`service` check without a booted init.* Containers here never run systemd
as PID 1 (no `--privileged`, no cgroup mounts, no boot race — considered and
rejected as unnecessary complexity for what "enabled/disabled" actually
needs). `systemctl --root=/ is-enabled <unit>` is systemd's own documented
offline mode (used by chroot/image-building tools like mkosi/debootstrap):
it reads unit/`.wants` symlinks directly from the filesystem, never talks to
a running PID 1 or D-Bus. Sufficient for every check planted so far (only
enabled/disabled, never live active/running state); live active-state
polling is a real future requirement (Phase 2 debrief's critical-service
uptime %, DECISIONS 013) deferred until the orchestrator runs boot-capable
lab containers — noted as a known scope limit in `agent/README.md`, not a
bug.

*`agent/` Go module.* `github.com/roundzero/agent`, Go 1.23, one dependency:
`gopkg.in/yaml.v3` (MIT, compiled into a static `CGO_ENABLED=0` binary — zero
runtime deps). No local Go install is assumed anywhere in this repo or CI —
build/vet/test all run inside a `golang:1.23` container
(`agent/scripts/prove.sh`, and a new parallel `agent` job in
`.github/workflows/ci.yml` using `actions/setup-go`, independent of the
existing pnpm/Next.js job).

*`linux-practice` vulnerable image + proof harness.* `agent/image/Dockerfile`
(`ubuntu:24.04`) plants 10 vulns spanning every category in
`packages/content/checklists/linux-core.yaml` (accounts, PAM, SSH,
services/persistence, file perms, updates/firewall) plus 2 zero-point decoy
checks proving the engine respects an authorization model instead of
blanket-flagging (an odd-named but authorized sudoer; a required service
staying enabled). `agent/image/answer-key.yaml` is the machine-readable
manifest (distinct from `agent/checks/linux-practice.yaml`, the engine's
actual scoring input) — every planted vuln's category/points/skillNode/
remediation, kept in lockstep by hand per `agent/README.md`'s "how to add a
vuln" process (Dockerfile injection + fix script + check entry + answer-key
entry, no engine changes). `agent/scripts/prove.sh` builds the agent (in a
`golang` container) and the image, then runs all four states from a fresh
container each time — fresh vulnerable (0/100, exactly the 10 vulns fail),
fully hardened (100/100), half-fixed (exactly the sum of 5 chosen fixes, no
partial credit), and the alternate SSH fix (drop-in only, 12/100) — grepping
each JSON report's totals and self-asserting every expected number (exit
non-zero on any mismatch), plus the bonus main-file-only demo above.
Containers run with `--cap-add=NET_ADMIN --cap-add=NET_RAW` (not
`--privileged`): `ufw enable`'s iptables/nftables rule loading and network
sysctls need these even outside a booted init, and the real orchestrator
will need to grant lab containers the same for students to run `ufw enable`
themselves. `RUN mkdir -p /run/sshd` in the Dockerfile is required for
`sshd -T` to run at all in this environment — that directory is normally
created by systemd-tmpfiles at boot, which never happens here. Verified end
to end: `go vet`/`go test ./...` (32 unit tests) green inside a
`golang:1.23` container; `agent/scripts/prove.sh` passes all four states +
the bonus demo against real Docker Desktop, self-asserted, exit 0.

**027 · 2026-07 · In-browser lab terminal: `lab-broker/` (Node/TS, standalone)
+ `TerminalFrame`/`ScoreLine` in `packages/ui` + `/app/lab`. Local-only.**
The first end-to-end Phase 2 loop a student actually touches: launch a
practice lab, get a live root shell in the `linux-practice` container from
inside the browser, harden it, click Score, see the report. Scope
deliberately stayed local + single-lab (no multi-tenant isolation, gVisor,
pooling, or cloud — those are the orchestrator, a later session).

*Why a separate service, not Next.js.* Vercel is serverless (no container
host, no persistent socket) and reaching Docker from the Next dev server
locally is fragile. `lab-broker/` owns all container lifecycle + the
terminal bridge and is the earliest seed of the Phase 2 orchestrator —
config-driven (`HOST`/`PORT`/`RZ_IMAGE`/etc., see `lab-broker/README.md`) so
it can move to a remote host later without an app-side rewrite.

*Node/TS, standalone outside the pnpm workspace, dockerode over shelling
out.* Node/TS for cohesion with the rest of the repo — `agent/` is Go
specifically because 003's rationale (static binary, zero runtime deps,
drops into any container) doesn't apply to a long-running host service.
Standalone (own `package.json`, own `npm install`) rather than a workspace
package: keeps Docker-facing dependencies (`dockerode`, `ws`) out of
`apps/web`'s install and the Vercel bundle entirely, mirroring how `agent/`
is already a separate Go module with its own CI job. The interactive shell
is `docker exec` with `Tty: true` over `dockerode` (the Docker Engine HTTP
API) — the container's *own* PTY comes back over a hijacked connection, so
this needs no *local* PTY and therefore no `node-pty` (native bindings,
historically the fragile part of Node terminal bridges on Windows/WSL).
dockerode's default socket detection (`/var/run/docker.sock` on Linux/WSL,
the `//./pipe/docker_engine` named pipe on Windows) means the same code runs
in the WSL target and was proven here directly against Docker Desktop on
Windows. The one place this reaches for the `docker` CLI instead of the
Engine API is copying `rzagent` + the check file into a fresh container
(`docker cp`) — dockerode's `putArchive` wants a tar stream, and shelling
out reuses the exact command `agent/scripts/prove.sh` already proves works,
avoiding a `tar-stream` dependency for one call site.

*Terminal WS protocol.* Client→broker binary frames = raw stdin bytes;
client→broker text frames = JSON `{type:"resize",cols,rows}`; broker→client
binary = raw container stdout (a real TTY, so Docker never multiplexes it).
Found via `lab-broker/scripts/prove.mjs` during this session: the server's
`ws.on("message", ...)` listener was originally attached *after* `await
docker.openShell(...)` — since `docker exec` create is a real network call,
the client's initial resize + first keystrokes (sent immediately on WS
`open`) arrived before that listener existed and were silently dropped
(`EventEmitter` doesn't queue events with no listener). Fixed by attaching
the message listener synchronously before the await and buffering
input/resize until the shell exists, then flushing — `server.ts`'s
`attachTerminal`.

*`packages/ui`: `ScoreLine` (first real use of the DESIGN.md signature
grammar) and `TerminalFrame` (`@xterm/xterm@6.0.0` +
`@xterm/addon-fit@0.11.0`, new dependency — the DESIGN.md v1 inventory item,
built for real now instead of chrome-only). `TerminalFrame` is a pure
primitive: it owns the `Terminal`/`FitAddon` instance and exposes
`write`/`clear`/`focus`/`fit` via ref plus `onData`/`onResize` props, but
never opens a socket — `apps/web`'s `lab-console.tsx` owns the WebSocket.
Its background/foreground/cursor/selection colors are the DESIGN.md token
hexes as literal strings, not `var(--token)` — xterm renders to `<canvas>`,
whose 2D context needs a resolved color, not a CSS custom property. The
16-slot ANSI palette (a shell's own `ls --color`, prompt colors) is
deliberately left at xterm's built-in default rather than mapped to
`--score`/`--penalty`: those tokens are reserved exclusively for scoring
semantics (DESIGN.md hard rule) and a shell's red/green is the machine's own
language, not a RoundZero scoring signal. `ScoreLine` maps a check's
`pass`/`earned` into `found`/`missed` (the Go agent has no penalty-type
check yet, so `penalty` is implemented per DESIGN.md's grammar but unused
by this feature).

*Score enrichment stays server-side.* `apps/web/src/app/app/lab/actions.ts`'s
`scoreLab` takes the broker's raw report (id/title/skillNode/points/earned/
pass/detail) and resolves each `skillNode` against Prisma
(`SkillNode.parent.title` for the category chip, `LessonSkill` for a
published lesson link) the same way `checklists/[id]/page.tsx` already does
— the taxonomy spine (CLAUDE.md rule 2) stays the single source for
category/lesson mapping; `lab-broker` itself never touches the app DB.

*Browser talks to the broker two ways.* The terminal WebSocket connects
**directly** from the browser to `LAB_BROKER_URL` (a WebSocket can't be
proxied through a Vercel serverless function, and this feature is
local-only anyway) — `launchLab()` hands back the exact `ws://` URL derived
server-side so `LAB_BROKER_URL` itself never has to be a `NEXT_PUBLIC_` var.
Lifecycle/score calls (`POST /labs`, `POST /labs/:id/score`, `DELETE
/labs/:id`) go through Next server actions instead, both to keep the broker
URL server-side and because scoring needs the Prisma enrichment above. No
CORS handling in `lab-broker`: the JSON endpoints are server-to-server and
the WebSocket protocol isn't subject to CORS.

*Local-only — does not work on the Vercel deploy.* `apps/web` builds and
deploys exactly as before with `LAB_BROKER_URL` unset; `/app/lab` renders a
designed "lab isn't configured" error state instead of crashing. Verified:
`pnpm build` with the same placeholder env vars CI uses (no
`LAB_BROKER_URL`) succeeds and includes the `/app/lab` route. Production is
unblocked only by the Phase 2 orchestrator running on a real host — not
scoped to this session.

*Root `eslint.config.mjs`* gained a scoped override for `**/*.mjs` files
(`console`/`process`/`fetch`/timers/`Buffer` as globals) — `.ts` files
already get these for free from `@typescript-eslint`'s recommended
eslint-recommended override, but `lab-broker/scripts/prove.mjs` is plain JS
and has no such override, so `no-undef` needs the Node globals spelled out
by hand rather than pulling in the `globals` package for one file.

Verified end to end: `lab-broker`'s `vitest` (16 tests: `registry.ts`
lifecycle/idle-sweep bookkeeping against a fake driver+clock, `score.ts`
parse/shape against captured rzagent JSON shapes) and `tsc --noEmit` both
green, no Docker required. `npm run prove` (`lab-broker/scripts/prove.mjs`)
against real Docker + the real `linux-practice` image: launches a lab,
scores it fresh (0/100, matching `agent/README.md`'s known state), runs
`userdel -f backdoor` and `ufw --force enable` through the actual terminal
WebSocket, re-scores and asserts the total rose by exactly +22 (the two
fixed checks, no partial credit) and that both check ids flipped to
`pass:true`, deletes the lab, and asserts `docker ps -a` no longer lists the
container — self-asserting, exit 0. `pnpm lint`/`pnpm test` (170 tests
across `packages/db`/`apps/web`, unchanged — this session added no new
apps/web-side unit tests; `TerminalFrame`/`ScoreLine`/`lab-console.tsx` are
presentational/thin-glue, and the loop's real logic lives in `lab-broker`'s
own suite above) pass; `pnpm build` (root) succeeds both with and without
`LAB_BROKER_URL` set.

**028 · 2026-07 · The flight-recorder debrief (`DebriefView`): the Phase 2
showpiece per DECISIONS 010/013.** `/app/lab` now transitions into a full
debrief after a run — count-up score header, gauge strip, run-trajectory
chart, the `ScoreLine` list, and a footer that funnels missed checks into the
SRS drill. This is the new top-of-range craft reference (DESIGN.md's Screen
craft checklist) other screens get leveled toward.

*Score history is client-session, not broker- or DB-backed — and that's an
explicit, temporary choice, not an oversight.* `LabConsole`
(`apps/web/src/app/app/lab/lab-console.tsx`) accumulates a `ScoreSnapshot[]`
in React state (`elapsedMs` off a `launchedAtRef` captured on WS `open`,
`totalEarned`/`totalPossible`, `passedIds`) each time `scoreLab` succeeds.
`lab-broker` is **completely unchanged** by this session — it already returns
everything a trajectory needs per score call, and the client was judged
sufficient for a local, single-user build. Consequence, stated plainly: **the
trajectory is lost on a page refresh.** Persistent debriefs — a `LabRun` +
`LabScoreSnapshot` Postgres model so a run survives a refresh and a coach can
review it later — are deliberately deferred to the hosting/launch session;
that work is the trigger for moving score history server-side (the
orchestrator, not the client, owns run history from that point on), not
before.

*New `packages/ui` primitives, tokenized, no new colors.* `CountUp`
(`count-up.tsx`) is DESIGN.md's one expressive motion: `useState`'s initial
render is always the final `value` (matches whatever SSR emitted, no
hydration mismatch), and only a post-mount effect animates 0→value over
400ms with a `--score` text flash — `prefers-reduced-motion` (guarded against
`matchMedia` being unavailable, which jsdom doesn't implement and a test
below caught) skips the animation and leaves the correct value in place, at
rest, immediately. `RunTrajectoryChart` (`run-trajectory-chart.tsx`) wraps
`recharts` (new dependency, `3.10.0`, MIT, React-19-compatible) in a thin,
fully-controlled primitive: a `stepAfter` line seeded with a synthetic
`(0, 0)` launch point, DESIGN tokens passed as literal `var(--x)` strings
(SVG presentation attributes resolve CSS custom properties directly, unlike
`TerminalFrame`'s canvas — see 027), no entrance animation
(`isAnimationActive={!prefersReducedMotion()}`). The whole chart is wrapped
`aria-hidden="true"` with a `<figcaption class="sr-only">` numeric summary —
it's enhancement only, the `ScoreLine` list is the at-rest source of truth,
and nothing about reading the run depends on the chart rendering or
animating at all. `accessibilityLayer={false}` is set on `LineChart`
explicitly: recharts v3 defaults that to `true` and puts a keyboard-focusable
`tabIndex` on the root `<svg>` regardless of an `aria-hidden` ancestor —
without this override, a Playwright keyboard-tab audit during this session's
verification caught a real dead tab stop (focusable, but invisible to
assistive tech). Optional `activeCheckIds`/`onActiveCheckIdsChange` props
give hover **and** row-hover a shared highlight (a hovered `ScoreLine` row
highlights its chart point and vice versa) — mouse-only by design, since the
event list already has full keyboard access on its own merits (the
`ScoreLine` rows themselves aren't made artificially focusable just to drive
the chart).

*Missed checks auto-enqueue to the SRS drill.* `enqueueSkillNodeCards`
(`apps/web/src/lib/drill.ts`) generalizes the existing lesson-completion
enqueue path (`enqueueLessonCards` now just calls it) — idempotent via the
`(userId, cardId)` unique constraint + `skipDuplicates`, same as before. A
new server action, `enqueueMissedDrills` (`apps/web/src/app/app/lab/
actions.ts`), is called once the debrief mounts; the footer reports the
number actually enqueued, or falls back to a plain missed-count line once
everything's already queued (re-viewing the same debrief, or re-scoring).

*Critical-service uptime gauge: omitted, not stubbed.* DECISIONS 026 already
scoped live active/running-state polling as a known limit until the
orchestrator runs boot-capable containers — the gauge strip conditionally
omits that `Stat` entirely (screen-craft checklist: no dead columns) rather
than rendering a placeholder. Same treatment for the penalties `Stat` — the
Go agent has no penalty-type check yet (027), so it's only rendered when
`penaltyRows.length > 0`.

*The terminal stays mounted (hidden), not unmounted, while the debrief is
showing.* `LabConsole` gained a `"debrief"` phase. Entering it just
CSS-hides the `TerminalFrame` block (`hidden` class) instead of conditionally
unrendering it — unmounting would dispose the live `xterm.js` `Terminal`
instance while the WebSocket (owned by `LabConsole`, independent of
`TerminalFrame`) keeps running, silently dropping any container output that
arrives while the debrief is on screen. "Back to lab" re-shows it and
re-`fit()`s (a hidden container has zero measured size, so `ResizeObserver`
alone won't catch the reveal). "Retry" stops the current lab and launches a
fresh one, resetting history.

Verified end to end against a **real** run: started `lab-broker` + `next dev`
locally against real Docker (`rz-practice:latest` + `agent/rzagent`, both
already built), drove a real lab over the exact WS terminal protocol the
browser uses (launch → score fresh 0/100 → `userdel -f backdoor` + `ufw
--force enable` → score 22/100 → two more inert commands → score 22/100
again, deliberately proving the chart's plateau rendering too), captured the
three real `rzagent` JSON reports. `/app/lab` itself is session-gated and
this sandbox has no way to drive real interactive Google OAuth or read a
magic-link email — rather than skip verification, a throwaway local account
was created and signed in through the app's **own** magic-link API (a token
read from that one throwaway account's own `Verification` row, not any real
user's credentials), the real `DebriefView` was rendered against the
captured report data (enriched through the same Prisma taxonomy/lesson
lookups `scoreLab` uses) via a temporary, uncommitted preview route
(deleted before commit, same pattern as 019/022/027), then the throwaway
user/session/account rows were deleted afterward. Confirmed via Playwright
(ephemeral `npx`, not added to any `package.json`, per 019's precedent): the
trajectory chart's shape matches the real 0→22→22 progression; the score
header shows `22` immediately under `reducedMotion: "reduce"` (not `0` or a
mid-animation value); no horizontal overflow at 1024px (the narrowest real
Chromebook width, per 022); a keyboard tab sweep reaches "Back to lab" and
"Retry" with visible focus rings and no dead stops (after the
`accessibilityLayer` fix above); hovering a found `ScoreLine` row visibly
highlights its chart point. The dev server log confirmed `enqueueMissedDrills`
ran successfully server-side against the real dev DB. Added
`apps/web/src/app/app/lab/count-up.test.tsx` (2 tests, jsdom): `CountUp`'s
synchronous pre-effect render already shows the final value, not `0`/blank —
this repo has no `packages/ui`-level test infra and "UI gets tested by use,
not snapshots" (CLAUDE.md), so this lives in `apps/web` against the existing
vitest+jsdom+testing-library setup rather than standing up new
infrastructure for one component. `pnpm lint`/`pnpm typecheck`/`pnpm test`
(172 tests across `packages/db`/`apps/web`) pass; `pnpm build` (root)
succeeds with the exact CI placeholder env vars and no `LAB_BROKER_URL` set
(the Vercel-deploy scenario — the lab feature stays dark, everything else
still compiles).

**029 · 2026-07 · Craft pass: every screen leveled to the debrief's bar.**
Presentation only — no route/data/server-logic changes. Three parallel
audits (lessons+checklists, drill+team, app-shell+landing) found the same
handful of gaps recurring everywhere rather than screen-specific problems,
so this pass fixed each systemically as a `packages/ui` primitive, then
applied it screen by screen.

*New primitives, tokenized, no new colors/motion.* `Eyebrow` (the 11px/
uppercase/tracked/text-dim label, polymorphic via an `as` prop) replaces
seven-plus hand-copied instances of the same class string (PageHeader,
Stat, debrief-view, lessons' domain heading, checklist TOC, join-code,
drill-session ×2) — `PageHeader` and `Stat` now compose it internally.
`ErrorNote` (AlertCircle + bordered note, deliberately neutral — DESIGN.md
reserves `--penalty` for scoring, not form errors) was extracted verbatim
from team-chooser's local copy/roster-table's inline block and adopted by
both plus drill-session, lesson-check, and lab-console's error lines (the
last of which was actually misusing `text-penalty` for a connection error —
a real, if minor, violation of the scoring-color rule, now fixed as a
side effect). `Kbd` (keyboard-hint chip) was extracted from drill-session's
3 duplicates. `PageHeader` gained an optional `support` prop (the `<p
class="mt-1 text-sm text-text-dim">` description line every screen was
repeating by hand), killing ~5 duplicate lines.

*Deliberately not adopted: `ScoreLine` on checklist items or lesson-check
results.* The audit suggested both as reuse targets (DESIGN.md's ScoreLine
section mentions "checklist cross-reference" as a future surface). On
inspection, neither is a scored item — no points, no found/missed-against-
a-round semantics, just reference actions and quiz correctness — so forcing
`--score`/`--penalty` grammar onto them would be exactly the decorative
misuse DESIGN.md's hard rule forbids. Both got lighter, purpose-built
polish instead: checklist item rows gained a neutral leading `ChevronRight`
glyph (rhythm parity with every other glyph-led row, no scoring tone);
lesson-check's result rows swapped `Check`/`X` for `CircleCheck`/`Circle`
(matching ScoreLine's own glyph vocabulary without borrowing its points/
category machinery) and gained a `StatStrip` (Score / Correct) above the
list, mirroring the gauge-strip treatment used everywhere else.

*`RunTrajectoryChart` fix — the actual bug, caught live in review.* The
chart read as mostly empty on a typical low-scoring run: the Y-axis was
meant to be `[0, Math.max(totalPossible, finalEarned)]`, but the
`ReferenceLine`'s `ifOverflow="extendDomain"` was silently overriding that
and forcing the axis to span the full 0–100 regardless — a 22-point run left
~3/4 of the chart empty. Fixed three ways: (1) the Y-axis now auto-ranges
via a domain function, `[0, (dataMax) => Math.min(totalPossible,
Math.max(Math.ceil(dataMax * 1.25), 10))]` — 25% headroom above the run's
own max, floored at 10 so a flat-zero run still breathes, clamped so it
never exceeds `totalPossible` (a near-complete run still uses the full
range, unchanged); (2) `ifOverflow` switched to `"hidden"` so the ceiling
line only renders when the run's own range naturally reaches it, never
forcing empty headroom; (3) `<Line>` became a single `<Area>` (recharts
`AreaChart`) with a `var(--score)` fill at 12% opacity under the `stepAfter`
stroke, and every snapshot now gets a marker (not just found-events) —
`markerKind()` classes each point `found` (bright `--score`/`--accent`
dot), `start` (the synthetic 0-point, dim), or `rescore` (scored again,
nothing changed, dim) — so the chart reads as the whole run, not just its
high points. `aria-hidden`, `accessibilityLayer={false}`, reduced-motion
handling, and the hover/row-linking API are all unchanged.

*Font-hosting TODO (DECISIONS 012) explicitly left open.* The shell audit
flagged it as the single biggest remaining gap (Switzer/IBM Plex Mono still
fall back to system fonts), but it's an asset/licensing acquisition, not a
presentation-consistency fix, and unattended third-party font fetches were
already rejected once during scaffolding — out of scope for a craft pass,
revisit deliberately.

*Per-screen, mechanical once the primitives existed:* `/app/lab` +
`lab-console.tsx` gained a `StatStrip` (Status / Container / Runs scored —
all from existing state, no new logic) above `TerminalFrame` plus a
`border-t` separator on the action row, giving the pre-debrief console the
same gauge-context the debrief has. `lessons/page.tsx` and
`checklists/page.tsx`'s hand-rolled empty-state `Card`s became `EmptyState`.
`lessons/[slug]/page.tsx`'s inline `<h1>`+Badge became `PageHeader`,
matching checklists/[id]'s already-correct pattern (title-tier
consistency). `team/page.tsx` gained `eyebrow="Team"` (the only main
PageHeader missing one) and the `support` prop. `roster-table.tsx`'s header
went `text-xs` → `text-[13px]` (DESIGN's 13/20 dense-data spec).
`team-chooser.tsx`'s `BackButton` gained the `:focus-visible` ring it was
missing (a real a11y gap) and matched the established back-link sizing.
`/app/page.tsx` (dashboard) — the one screen the shell audit flagged as the
clear outlier, a bare `<h1>` with no eyebrow at all — now uses `PageHeader`.

*DESIGN.md.* The "packages/ui v1 inventory" list had drifted stale across
several sessions (missing Avatar/Stat-StatStrip/CountUp/RunTrajectoryChart
entirely) — reconciled against the actual `packages/ui/src/index.ts`
exports, not just appended to. Screen craft checklist gained a line
codifying `gap-8` as the standard section rhythm (debrief's dialect) now
that this pass establishes it everywhere, replacing the `mt-6`/`mt-8`
stacking half the app used.

Verified: `pnpm lint`/`typecheck`/`test` (same 172 tests — presentation-
only, no new logic to test) and `pnpm build` (root, CI placeholder env,
no `LAB_BROKER_URL`) all green. Screenshotted every screen in scope at
1280px and 1024px via Playwright (ephemeral `npx`, no `package.json`
change) against real seeded dev-DB data: a throwaway local account created
through the app's own magic-link API (token read from its own
`Verification` row, never a real user's credentials), used to create a
real n=1 team (exercising the coach-panel state), answer a real lesson
check (exercising both `CircleCheck`/`Circle` result states and the new
`StatStrip`), and drill a real due queue — then the throwaway user, team,
and all related rows deleted afterward. `/app/lab` + the debrief were
verified against a real run through `lab-broker` + Docker (launch → score
0/100 → real fixes via the terminal WS → score 22/100), confirming the
reworked chart's auto-ranged axis, area fill, and per-point markers render
correctly against real data, and that the container was cleanly stopped
afterward (`docker ps -a` empty, broker's `/labs` empty). No horizontal
overflow at 1024px on any screen. No preview-route scaffolding was needed
this session (unlike 019/022/027) since every screen in scope was already
reachable through real auth.

**030 · 2026-07 · linux-practice vuln expansion: 10 → 30.** Content wiring
only — `agent/VULN_EXPANSION_SPEC.md`'s 20 new planted vulns + 1 new decoy,
all reusing the existing 7 check types (`user`, `command`, `file_contains`,
`file_mode`, `package`, `service`, `sshd_config`); zero engine/Go changes,
zero new taxonomy IDs. Verified the spec's tricky wiring caveats live
against `ubuntu:24.04` before writing any check (login.defs's default
`PASS_MAX_DAYS 99999`, pwhistory.conf shipping fully commented, `sshd -T`
defaults, sudoers.d/README's clean grep, and — the one genuine unknown —
that `systemctl disable rpcbind.service` **without `--now`** works offline
in a non-booted container (exit 0, flips `is-enabled`) while `--now` fails
trying to reach a live D-Bus; confirmed by direct `docker exec` probes, not
assumed from the spec's caveat text alone).

*Points: 176 new / 276 total, not the spec's floated "~200/300."* The
spec's own per-item point list (8–12 each, as instructed) sums to 176, not
200 — it explicitly delegates the exact total ("the session may
rescale... whatever the total, the 4-state proof must still assert exact
sums"). Kept the spec's own per-item weights rather than padding to a
vanity round number: `totalPossible` is 276 (100 existing + 176 new), 30
scored checks + 3 decoys (33 total). `prove.sh` asserts 276 exactly.

*Two checks needed a real design call to fit the "no `all:`/`any:`
composition" engine (schema.go):* `pwquality-credits` counts the four
credit-class lines via a `command` check (`grep -oE
'^[[:space:]]*(dcredit|ucredit|ocredit|lcredit)...' | sort -u | wc -l`,
pattern `4`) rather than a single `file_contains` regex, since Go's RE2
regexp has no lookahead to assert "all four present, any order." It's
credited by the *existing* `fix-pwquality.sh` (already writes all five
lines together) — a deliberate, realistic overlap, not a bug: an admin sets
minlen and the credits in one edit. `pwhistory-remember` needed to credit
either of two files (24.04's own `pwhistory.conf` reader, or an explicit
`pam_pwhistory.so remember=` in `common-password`) — implemented as a
`command` check that filters out comment lines from both files
(`grep -v '^\s*#'`-equivalent) then searches the combined remainder, the
same "compute the effective state via a command" trick `sshd_config`
already uses for merged config. `scripts/prove.sh`'s alternate-fix state
proves the alternate location actually credits (`fix-pwhistory-alt.sh`,
demo-only, not in `fix-all.sh`).

*A new SSH drop-in trap, not just two new directives.* `ssh-maxauthtries`
and `ssh-x11forwarding` plant `MaxAuthTries 6` / `X11Forwarding yes` in a
**new** `/etc/ssh/sshd_config.d/60-devops-limits.conf` — the same
Include-order trap as the existing `ssh-permitrootlogin`/50-cloud-init.conf
— rather than relying on the (also-vulnerable) unset/stock-file defaults,
so the lesson stays "find and fix the file that actually wins," not just
"set a directive." `prove.sh`'s bonus trap-demo was extended to prove
editing only the main `sshd_config` fixes none of the three SSH checks.

*`fix-half.sh` redefined* (66 pts: uid0 12 + unauthorized-sudo 10 +
pwquality-minlen 10 + pwquality-credits 10 + faillock-deny 8 + shadow-mode
8 + sysctl-ip-forward 8) to add a genuine **partial-credit-within-one-file**
proof: `fix-sysctl-partial.sh` writes only the `ip_forward` line to
`99-roundzero.conf`, leaving `rp_filter`/`accept_redirects` unset —
`prove.sh` asserts `sysctl-ip-forward` passes while the other two still
fail, proving a partial write to a multi-check config file credits only
the check whose line was actually written, never bleeds.

Per the wiring caveats: all three sysctl checks (`ip_forward`, `rp_filter`,
`accept_redirects`) grade `/etc/sysctl.d/99-roundzero.conf`'s *content*,
never live `sysctl` (Docker owns net.* on the host); `rpcbind-disabled` is
a `service`/`disabled` check (enabled-by-default via its own postinst,
confirmed live), not a live-running check. Two existing decoys stay
untouched; the new `decoy-required-cron` (a legitimate README-required
`/etc/cron.d/backup` job) is zero-scored and fails if over-zealously
deleted, same authorization-model lesson as the other two.

Verified: `bash agent/scripts/prove.sh` — all four states + the bonus trap
demo green (fresh 0/276 with 30 failing/3 passing; hardened 276/276, 33/33
passing; half-fixed exactly 66 with the partial-sysctl proof; alternate-fix
exactly 36 across the three drop-in/alternate-location checks; bonus
confirms all three SSH checks stay blocked without the winning drop-ins).
`go test ./...`, `go vet ./...`, and `gofmt -l .` all clean (no engine
files touched). Cross-checked mechanically: check-file ids ↔
answer-key.yaml checkIds are exactly 1:1 (33 each), and every `skillNode`
used resolves to a real taxonomy.yaml leaf.

**031 · 2026-07 · Forensics question bank — Part A of
`docs/FORENSICS_BUILD_SPEC.md`.** New content-as-code type,
`packages/content/forensics/*.yaml` (one file per archetype), following the
exact pattern lessons (020)/checklists (022)/cards (024) already established:
pure `parse`/`grade`/`reconcile` in `packages/db/src/forensics/` (unit-tested,
no DB/framework imports), a thin `syncForensics` glue in `prisma/seed.ts`, a
new `forensics.core.accounts` taxonomy leaf (deprecation-safe add, per
006 — the UID-lookup archetype didn't fit `file-hunting` cleanly, exactly
the escape hatch the build spec anticipated). Authored 24 questions, 3 per
archetype, each independently verified against a real command (base64/
ROT13 via `tr`, md5sum/sha256sum) run through this session's own shell
rather than hand-computed, so the "technique" lines are provably correct,
not just plausible-looking.

*The answer key never touches the DB, same discipline as Lesson's `check`
(020).* `ForensicsQuestion` (new model) stores only `id`/`archetype`/
`skillNodeId`/`prompt`/`given`/`sortOrder` — `answer`/`accepts`/
`case_sensitive`/`strip_trailing_slash`/`technique`/`why` live solely in the
YAML and are re-parsed server-side (`apps/web/src/lib/forensics-content.ts`,
mirrors `lesson-content.ts`) at grading time. Grading is a two-action split
in `apps/web/src/app/app/forensics/[archetype]/actions.ts`:
`gradeForensicsQuestion` grades one question for immediate feedback and
never persists; `completeForensicsSet` re-grades every question
authoritatively from the same YAML when a set finishes (never trusts a
client-reported correct/incorrect count) and is the only thing that writes
`ForensicsProgress` (new model, per-archetype best score via the existing
`bestScore()` from `lessons/grade.ts` — reused as-is, not duplicated) and
enqueues missed questions' skill nodes into the SRS drill via the existing
`enqueueSkillNodeCards` (no new drill-glue needed). `ForensicsQuestion` has
no per-question user-data FK (progress is per-archetype), so a question
dropped from the YAML is hard-deleted on reseed, like `ChecklistItem` (022),
not soft-deprecated like `DrillCard`/`SkillNode`.

*Grading normalization and the "close" format-mismatch detector
(`packages/db/src/forensics/grade.ts`), the actual design problem in this
session.* Trim always applies; case-folding and trailing-slash stripping are
per-question (`case_sensitive`/`strip_trailing_slash` in the YAML), matching
real CyberPatriot answer keys' genuine inconsistency about both. A "close"
result (right content, wrong format) carries a `FormatDiff` naming which
axis — case, trailing slash, internal whitespace — actually differs, so the
UI can teach the answer-format discipline specifically instead of a flat
"incorrect." The first implementation attempt flipped one axis at a time
from the question's own strict settings and re-compared; that only
correctly attributes a mismatch when exactly one axis differs — a compound
mismatch (wrong case AND a stray trailing slash at once) silently produced
all-`false` diff flags, since relaxing just one axis while holding the
others strict doesn't resolve a compound difference. Fixed by testing each
axis independently with the *other two* axes held maximally lenient (case-
insensitive, trailing slash stripped, whitespace collapsed) and only the
axis under test kept at its real strictness — this isolates each
contributing axis regardless of how many differ at once. Caught by a unit
test asserting all three flags true for a submission that differs on all
three axes simultaneously; the bug reproduced exactly as predicted before
the fix (all three false) and was verified fixed after.

*Schema.* Two additive models, one migration
(`add_forensics_question_progress`): `ForensicsQuestion` (indexed by
`archetype`) and `ForensicsProgress` (`@@unique([userId, archetype])`, best
score only — retakes never lower it, same as lessons). `ForensicsArchetype`
is a Prisma enum (8 values), not a bare string — matches the codebase's own
convention for every other bounded categorical field (`NodeKind`,
`TrackLevel`, `CardType`, `OS`, `EventKind`), a deliberate deviation from
this session's own initial plan (which had proposed a plain `String`
column) once the existing pattern was checked. `FORENSICS_ARCHETYPES` in
`packages/db/src/forensics/parse.ts` is the single source of truth mapping
each archetype's kebab-case key (content YAML, `/app/forensics/[archetype]`
route) to its enum value and display label.

*Surface.* `/app/forensics` lists all 8 sets with per-user best score
(mirrors `lessons/page.tsx`'s list-row pattern exactly, including the
`CircleCheck`/`Circle` glyph vocabulary — deliberately not `ScoreLine`, per
029's reasoning: a quiz-correctness list isn't a scored-round item).
`[archetype]/forensics-quiz.tsx` runs one question at a time — prompt +
`given` (a mono evidence block) → answer input → submit → feedback
(`CircleCheck`/`AlertCircle`/`Circle` for correct/close/incorrect, all
plain — `AlertCircle` in `text-accent` for "close" is a restrained,
non-decorative use: a format warning, not a score) → technique + why → next
→ a StatStrip summary at the end, matching lesson-check's score-color
threshold convention (`text-score` ≥70%, else `text-penalty`). The queue is
frozen via `useRef` on mount, same reasoning as `DrillSession` (025): the
final "See results" submission revalidates `/app/forensics/[archetype]`,
and the running session must never resync from a live prop underneath a
student mid-set. No custom keyboard-event plumbing needed (unlike drill's
number-key ratings): the answer form is a real `<form>` (Enter submits
natively) and the Next/results button gets `autoFocus` on each mount
(Enter/Space activates it natively) — simpler and avoids the double-fire
risk a global Enter listener would have next to a focusable native button.

No new dependency. `pnpm lint`/`typecheck`/`test` (149 `packages/db` tests,
including 35 new forensics parse/grade/reconcile ones, + 58 unchanged
`apps/web` tests — `forensics-quiz.tsx` is presentational/thin-glue like
`TerminalFrame`/`lab-console.tsx`, per 027's precedent, so its logic has no
unit tests of its own) all pass; `pnpm build` (root, CI placeholder env, no
`LAB_BROKER_URL`) succeeds — this is pure web content, so unlike the lab it
runs on the real Vercel production deploy. Verified against the real dev
Neon DB: `db:seed` created 24 questions (plus the 1 new taxonomy node) on
first run, all-unchanged on a second run; temporarily pointing a
`skillNodeId` at a nonexistent id failed the run with exit 1 and a precise
message, then reverted. End-to-end browser verification used the same
throwaway-account pattern as 019/022/027/028/029 (a magic-link token read
from that account's own `Verification` row, deleted afterward) driven via
ephemeral Playwright (`npx`, not added to any `package.json`): answered one
question correctly (case-varied), one incorrectly (confirmed the revealed
answer), and one in a doubled-internal-space "close" way (confirmed the
specific spacing-mismatch feedback fired, not a generic "incorrect") across
the `decoding` set; confirmed the 33% best score persisted across a full
page reload on both the set page and the index list; confirmed the one
missed skill node's drill card was enqueued and live-updated the nav badge
(`revalidatePath("/app", "layout")`) without a hard navigation, and showed
up due on `/app/drill`. No horizontal overflow at 1024px (Chromebook
width).

**032 · 2026-07 · Forensics quiz: "Try again" in place, found in production
testing.** A wrong answer during a set (031) stranded the student on that
answer for the rest of the set — retrying meant abandoning and re-entering
the whole set, an inconsistent flow since re-entering DID let them answer
again. Fixed as a pure `forensics-quiz.tsx` UI change: a "Try again" ghost
button next to Next/See results (shown whenever `feedback.status !==
"correct"`, i.e. both `close` and `incorrect`) clears `feedback` and
`inputValue`, re-showing the same question's answer form (which already
`autoFocus`es on remount, same as advancing to a new question). "Next"
keeps `autoFocus` and stays the Enter-default, per the existing
keyboard-first pattern — Try again is reachable by Tab/click, not made the
Enter default, so nothing about the prior keyboard flow changes for a
student who doesn't use it.

*Reveal-then-retry, not blind-retry, and no backend change was needed.*
Considered hiding the technique/answer/why until correct (blind retry), but
`close` status exists specifically to teach the answer-format discipline
immediately (030's whole point) — hiding the reveal on a wrong answer would
undermine that. Kept the existing reveal-on-any-submit behavior and let the
student re-attempt with it already in view (retrieval practice: type the
answer you just read, not stare at it). Scoring rule: the set scores each
question by its FINAL submitted answer, not the first attempt — a
correct-on-retry counts as correct, matching lessons' unlimited-retakes/
best-score philosophy (020) rather than a first-attempt-only rule, since
this is a practice tool, not a graded round. This required zero changes to
`gradeAnswer`, `gradeForensicsQuestion`, or `completeForensicsSet`: the
client's `answers` state was already a `Record<questionId, string>`
overwritten by questionId on every submit (needed originally just to
accumulate one answer per question for the end-of-set authoritative
re-grade), so a retry's later submission already superseded the earlier
wrong one in that map before this fix — the only thing missing was UI
exposure to trigger a second submit in place. `completeForensicsSet`
re-grades from that final map from scratch (031) and was already correct
by construction.

Added `forensics-quiz.test.tsx` (3 tests, mirroring `drill-session.test.tsx`'s
mocked-action pattern): Try again appears on incorrect and clears the
feedback/input for the same question index; Try again does not appear on
correct; and — the scoring-rule assertion — submitting wrong then retrying
correct results in `completeForensicsSet` being called with the retried
("hi"), not the original wrong, answer. `pnpm lint`/`typecheck`/`test` (149
`packages/db` + 61 `apps/web`, +3 from this fix) pass. Verified against a
real run through the local dev server + real dev DB (throwaway
magic-link account, same pattern as 019/022/027/028/029/031, deleted
after): answered a decoding question wrong, clicked Try again, confirmed
the same question re-appeared with an empty input (not advanced, not
still showing the wrong feedback), answered it correctly on the retry,
finished the set, and confirmed the summary scored it as correct (not
counted as a miss) and did not enqueue that question's skill node to the
drill.

**033 · 2026-07-22 · Networking/Cisco pillar Parts A + C:
`docs/CISCO_BUILD_SPEC.md`.** First networking content session — 9 lessons,
a generalized quiz engine (forensics' quiz UI/grading pulled out into a
shared primitive, per the spec's explicit ask), a 35-question networking
quiz bank, and 27 new drill cards. Pure web content, ships to production
exactly like forensics Part A (031). Part B (the subnetting trainer) is
explicitly deferred to a later session — not built here.

*Taxonomy* (additive, 006). Five new leaves —
`networking.fundamentals.ports`, `networking.devices.ios-basics`,
`networking.devices.routing`, `networking.devices.dhcp-nat`,
`networking.wireless.security` (new `networking.wireless` category) — filling
gaps the spec identified between the existing `networking.*` nodes and what
the lessons/quiz/cards below actually needed to reference.

*Lessons* (`packages/content/lessons/networking/*.mdx`, 020's pattern). Nine
lessons — OSI, TCP/UDP + ports, IP addressing/subnetting, VLSM, IOS basics,
IOS hardening, VLANs/trunking, ACLs, static routing — each with a 3-question
end-of-lesson check. Flipped to `published: true` this session after an
in-session factual-accuracy read (same precedent as Foundations, 020) so
`/app/lessons` and a real lesson check could actually be verified; no lessons
index/grouping code changes were needed — `groupLessonsByDomain`
(`apps/web/src/lib/lessons.ts`) was already domain-generic, so "Networking /
Cisco" appears as its own group automatically. The IOS-basics lesson carries
the pillar's one scope-honesty note (a link to Cisco Packet Tracer via
Networking Academy, cisco.com's own free distribution channel — flagged for
a human sanity-check since URLs aren't a thing this session can browse to
confirm); the `/app/networking` index repeats the same note so it's visible
without opening a lesson first.

*`remark-gfm` added to `apps/web`, pinned `^4.0.1`.* Real bug, not a
nice-to-have: several networking lessons use markdown tables (port lists,
CIDR/mask tables, VLSM allocation tables) and `next-mdx-remote`'s
`compileMDX` (020) never had GFM enabled — bare CommonMark has no table
syntax, so every pipe table was rendering as literal `|`-delimited text in
the browser, confirmed live before the fix (Playwright dump of the rendered
page showed raw `| Mode | Prompt |...` text) and confirmed fixed after
(`table`/`thead`/`tr`/`th` elements present, `thead th` text `["Mode",
"Prompt", "What you can do"]`). Wired via `compileMDX`s
`options.mdxOptions.remarkPlugins: [remarkGfm]`
(`apps/web/src/app/app/lessons/[slug]/page.tsx`); `mdx-components.tsx`
gained `table`/`thead`/`tr`/`th`/`td` mapped to DESIGN's 13/20 dense-data
style. Deliberately did NOT force `font-mono`/`tabular-nums` onto every
`<td>` — table content is a mix of prose (layer names, service descriptions)
and real machine data (IPs, masks, CIDR, port numbers); mono is reserved for
the latter (DESIGN.md), so the lesson source wraps just those values in
backticks (already-styled via the existing inline `code` component) rather
than the table styling forcing mono onto prose cells. MIT, zero runtime cost
(build/render-time only), no peer conflicts with `@mdx-js/mdx@3`.

*The quiz engine, generalized (the spec's explicit C1 mandate).* Forensics
quiz UI and grading (031/032) turned out to already be entirely
domain-agnostic — nothing about `gradeAnswer`/`normalizeAnswer` or the
question-at-a-time/feedback/retry/summary flow actually depended on
"forensics." Extracted rather than forked:
- `packages/db/src/forensics/grade.ts` moved verbatim (renamed
  `ForensicsAnswerSpec` to `QuizAnswerSpec`) to `packages/db/src/quiz/grade.ts`;
  `client.ts` re-exports it under both its new generic names and its
  original `Forensics`-prefixed aliases, so forensics own
  `actions.ts`/`grade.test.ts` needed zero changes beyond the import path.
- `forensics-quiz.tsx` (the client component) generalized into
  `apps/web/src/components/quiz/quiz-runner.tsx` — the first component
  outside `packages/ui` shared across features, so it lives in a new
  `apps/web/src/components/` rather than either features route folder.
  Fully prop-driven: `onGrade`/`onComplete` callbacks instead of imported
  server actions, `backHref`/`backLabel` instead of a hardcoded forensics
  link, `given` rendered only when present (networking questions often have
  none — pure recall, no evidence block). The forensics page now binds its
  existing actions via `completeForensicsSet.bind(null, archetypeKey)` (the
  standard Next.js pattern for passing extra arguments to a Server Action
  reference across the Server-to-Client boundary — a plain wrapper closure
  is NOT a valid prop here, since only Server Action references themselves
  cross that boundary) — required `completeForensicsSet`s signature to
  change from a single `{archetypeKey, answers}` object to
  `(archetypeKey, {answers})`, its only call site. `forensics-quiz.test.tsx`
  moved to `quiz-runner.test.tsx`, now exercising the generic component with
  mocked `onGrade`/`onComplete` props instead of a mocked module import —
  same three cases (031/032s retry-flow regression guards) plus a fourth
  confirming no evidence block renders when `given` is absent.

*Storage: generic `QuizQuestion`/`QuizProgress`, forensics NOT migrated onto
them.* `QuizQuestion(id, quizId, category, skillNodeId, prompt, given?,
sortOrder)` and `QuizProgress(userId, quizId, category, bestScore)` — the
networking-quiz analogue of `ForensicsQuestion`/`ForensicsProgress`, but
`quizId`/`category` are plain strings rather than a Prisma enum (`archetype`
is `ForensicsArchetype`), specifically so a third quiz never needs a schema
migration just to add a category. `packages/db/src/quiz/{parse,reconcile}.ts`
mirror `forensics/{parse,reconcile}.ts` exactly (own answer-key-never-in-DB
discipline, own hard-delete-on-drop reconcile per 022/031s no-user-data-per-
question reasoning) — deliberately NOT collapsed into one generic
parse/reconcile shared with forensics, matching the existing precedent that
every content type (lessons/checklists/cards/forensics) gets its own
parse/reconcile pair even though the shapes rhyme; forcing a shared
mega-parser across two content types with a still-open unknown (what a third
quizs fields even need) would be exactly the premature abstraction
CLAUDE.md warns against. Forensics own tables/parse module are UNCHANGED
and not deprecated — they shipped first, they work, and migrating a live
(if pre-launch) content type for symmetry alone is churn with no user
benefit. Additive migration `add_quiz_question_progress`.

*Networking quiz content* (`packages/content/networking-quiz/*.yaml`, 35
questions across 6 categories — subnetting, ports, protocols, ios-commands,
security, vlan-acl — one file per category, `README.md` documenting the one
contract delta from forensics: `given`/`technique`/`case_sensitive` are all
optional, since most networking recall has no evidence block to show and
isnt case-sensitive). `NETWORKING_QUIZ_CATEGORIES` (ordered key/label
list for the index page and routing) lives in
`apps/web/src/lib/networking-quiz-content.ts`, not in `packages/db` — unlike
`FORENSICS_ARCHETYPES`, theres no Prisma enum forcing a kebab-key-to-enum-value
mapping to live in the shared package, so this is purely apps/web display
config, the same way a hypothetical third quizs category list would be.
`/app/networking` (index) + `/app/networking/[category]` (`QuizRunner`-driven,
mirrors `/app/forensics/[archetype]` exactly) + `[category]/actions.ts`
(`gradeQuizQuestion`/`completeQuizSet`, the latter bound the same way
forensics `completeForensicsSet` is). `next.config.ts` traces
`packages/content/networking-quiz/**/*.yaml` for `/app/networking/**`, same
as forensics entry. `top-bar.tsx` gained a "Networking" nav link.

*IOS command drill cards* (`packages/content/cards/core.yaml`, appended — no
new file, matching the existing single-file convention). 24 `COMMAND` cards
on `networking.devices.*` nodes (enable/conf-t/copy-run-start/show
commands/hostname/interface IP/no-shutdown; enable-secret/service-password-
encryption/console+vty lines/crypto-key/banner; vlan create/access-port/
trunk-port/show-vlan; ACL write/apply/show; static+default route/show-ip-
route) plus 3 small `CONCEPT` cards filling a gap live verification actually
caught: `networking.fundamentals.ports`, `networking.devices.dhcp-nat`, and
`networking.wireless.security` are all referenced by quiz questions and/or
lessons but had zero cards, so a missed quiz question in those categories
silently enqueued nothing (the enqueue mechanism itself was never broken —
`enqueueSkillNodeCards` correctly finds zero active cards and enqueues zero,
same as it would for any node with no cards — but the SRS loop the spec
asked to "wire" was a no-op for those three nodes specifically until these
existed). All content flows into the daily drill through the two existing
enqueue paths unchanged: completing a networking lesson enqueues its cards
(`enqueueLessonCards`), and a missed networking quiz question enqueues its
skill nodes cards (`enqueueSkillNodeCards`, now called from
`completeQuizSet` the same way `completeForensicsSet` already calls it).

*Seed.* `prisma/seed.ts` gained `syncQuiz`, called after `syncForensics`,
identical shape to every other content sync (parse to `validateQuizRefs`
fails loudly on an unknown/non-leaf `skillNodeId` to reconcile to transaction
to summary counts).

Verified end to end against the real dev Neon DB: `db:seed` created 6
taxonomy nodes (4 updated — sortOrder shifted for existing siblings by
inserting new nodes among them, expected), 9 lessons, 27 cards (24 + the 3
gap-fill), and 35 quiz questions on first run; second run reported
everything unchanged; temporarily pointing a quiz questions `skillNodeId`
at a nonexistent id failed the run with exit 1 and a precise message, then
reverted. `pnpm lint`/`typecheck`/`test` (171 `packages/db` + 62 `apps/web`,
net +1 over pre-session — the forensics-quiz suites 3 tests became
quiz-runners 4) and `pnpm build` (root, CI placeholder env, no
`LAB_BROKER_URL`) all pass, including both new `/app/networking` routes in
the build output. Browser-verified against a real local dev server + the
real dev DB with a throwaway magic-link account (same pattern as every prior
sessions verification — token read from that accounts own `Verification`
row via a disposable script, never a real users credentials; account and
all its rows deleted afterward): took the "ports" quiz (RDP-port question
correct, four subsequent answers wrong — confirmed "Correct"/"Incorrect"/
"Try again" feedback, `20%` final score, exactly one missed questions card
enqueued to the drill, that score surviving a full page reload on the index);
completed the `ios-basics` lesson check (100%, its 8 cards enqueued,
`/app/drill`s due-count badge tracking both enqueues live); confirmed
"Foundations" and "Networking / Cisco" both render as lesson-index groups;
confirmed a forensics quiz still completes correctly through the now-shared
`QuizRunner` (regression check); confirmed tables render as real `<table>`
elements (not raw pipe text) across four table-bearing lessons with no
horizontal overflow at 1280px or 1024px.

**034 · 2026-07-22 · Networking/Cisco pillar Part B — the subnetting trainer
at `/app/subnetting`.** The one custom-interactive piece of the Cisco pillar
(`docs/CISCO_BUILD_SPEC.md` Part B), deferred from 033. Closes the pillar:
Parts A/B/C are all shipped.

*Two architecture calls made explicit up front, both confirmed with the user
before writing code.* (a) **The pure subnet-math/generator module lives in
`apps/web/src/lib/subnetting/`, not `packages/db`**, even though the spec text
and every other content type's precedent (taxonomy/lessons/checklists/cards/
forensics/quiz) puts pure logic in `packages/db`. Reason: this tool is the
first one that needs its pure logic to run **client-side** (instant per-field
checking + worked-solution reveal, no server round trip) — and
`packages/db/src/client.ts` is a single barrel that constructs a real
`PrismaClient` at module scope (`export const prisma = ... new PrismaClient()`),
which is not browser-safe and, confirmed by grepping the whole app, no
`"use client"` component anywhere imports `@roundzero/db` today. Colocating in
`apps/web/src/lib` — where `checklists.ts`/`lessons.ts`/`teams.ts` and their
own `*.test.ts` already live, same Vitest `node` environment — keeps Prisma
fully out of the client bundle with zero `transpilePackages`/`next.config.ts`
changes, at the cost of this one module not being reusable outside apps/web
(nothing else needs it). (b) **Best quick-round accuracy reuses `QuizProgress`**
(`quizId="subnetting"`, `category="quick-round"`) rather than a new
`SubnettingProgress` model — no migration, same pattern DECISIONS 033 already
established for a second quiz. Endless-mode accuracy is session-only, never
persisted (nothing in the spec asked for that, and there's no natural "round"
boundary to score in an infinite mode).

*Why the math can safely run entirely client-side, unlike every other content
type in this repo.* Lessons/checklists/forensics/quiz all keep their answer
key server-side and re-parse it at grading time specifically so a client can't
inspect the network tab and cheat (020/031). Subnet math has no equivalent
secret: the "answer key" is arithmetic anyone can (and does) compute by hand —
shipping it to the browser reveals nothing. `recordQuickRound` (`actions.ts`)
still re-derives the round from its `seed` and re-grades authoritatively
server-side before touching `QuizProgress`, but that's to stop a tampered
client from writing a fake **persisted best**, not to protect a secret.

*The pure module, four files, heavily unit-tested (91 tests total in
`apps/web`'s suite, up from 62 before this session).* `math.ts` — IPv4 as
`uint32`, `parseIp`/`formatIp`/`ipToBinary`, `maskFromPrefix`/`prefixFromMask`
(rejects a non-contiguous mask), `computeSubnet` (network/broadcast/first-last
usable/usable count/block size), `vlsmFit` (smallest subnet for a required
host count). Host-count convention, deliberately documented rather than
silently chosen: `usableHosts = max(2^hostBits - 2, 0)`, so `/30`→2, `/31`→0,
`/32`→0 — the classic subnetting-class formula every CyberPatriot student is
taught; `firstHost`/`lastHost` are `null` when `usableHosts` is 0.
`vlsmFit` searches only `/30` down to `/0` (excludes `/31`/`/32` by
construction — VLSM asks for an actual LAN subnet). `generate.ts` — a
dependency-free inline `mulberry32` seedable PRNG (`makeRng`), four problem
types (`cidr-breakdown`, `mask-breakdown`, `vlsm-fit`, `which-subnet`),
`generateRound(seed, count, types?)` fully deterministic (same seed → same
round, the property `recordQuickRound` relies on to re-derive a submission
server-side). Generated breakdown/which-subnet problems are biased to
`/16`-`/30` so `usableHosts >= 2` always holds (no dead `firstHost`/`lastHost`
fields in the generated UI) — `/31`/`/32` are covered in `math.test.ts` only,
per the spec's explicit ask for edge-case coverage, not asked as generated
problems. `grade.ts` — per-field checking by canonical VALUE (an IP field is
correct if it parses to the same address, tolerating a leading-zero octet;
numeric fields tolerate whitespace; a CIDR field accepts `26` or `/26`),
deliberately more forgiving than the quiz/forensics exact-string grading since
there's no typing-discipline lesson here, only a subnetting-fluency one.
`explain.ts` — the worked-solution builder: binary IP/mask/network/broadcast
strings plus step-by-step prose (block size, host bits, the AND-mask
derivation), with a `/31` (RFC 3021 point-to-point) / `/32` (single-host route)
note surfaced only when relevant.

*Surface.* `/app/subnetting` (`page.tsx` server component: auth gate, reads
`QuizProgress` best, renders `PageHeader` + the trainer) + `actions.ts`
(`recordQuickRound`, zod-validated at the boundary, re-derives+re-grades from
the seed, upserts via the existing `bestScore()` from `@roundzero/db`) +
`subnetting-trainer.tsx` (`"use client"`, the actual tool: quick round (5) /
endless practice, an optional problem-type filter, an optional count-up timer
via the existing `formatElapsed` from `@roundzero/ui`, per-field
correct/incorrect glyphs matching the quiz-runner vocabulary — deliberately
**not** `ScoreLine`, same reasoning as 029: this isn't a scored competition
round). A "Try again" retry clears only the fields that were wrong (keeps
correct ones filled), a small UX improvement the per-field-check shape enables
over `QuizRunner`'s blunt full-clear retry. Added `Calculator`/`ArrowRight`
cross-link card on `/app/networking` pointing at the trainer, and a
"Subnetting" `top-bar.tsx` nav entry next to "Networking".

Verified: `pnpm test` (`apps/web`, 157 tests total) green, including 91 new
subnetting tests — exhaustive known-answer math coverage across `/8` through
`/32` (explicit `/30`/`/31`/`/32` edge cases), VLSM fits, generator
determinism, per-field grading, and a `subnetting-trainer.test.tsx` exercising
the **real** production component end-to-end via `@testing-library/react`
(submit all-correct → every field green + worked solution shown; submit wrong
→ that field flagged + expected value revealed; "Try again" clears only the
wrong field and a resubmit goes clean; finishing a 5-problem round calls the
mocked `recordQuickRound` with the seed + all 5 collected answers). `pnpm
lint`/`typecheck` clean for every new/changed file (two pre-existing lint
errors this session did NOT introduce or touch remain in `quiz-runner.tsx`/
`drill-session.tsx` — an `eslint-plugin-react-hooks` rule newly flagging the
`useRef(...).current` read-during-render pattern DECISIONS 025/031
deliberately established; out of scope here, flagged for a follow-up session).
`pnpm build` (root, CI placeholder env, no `LAB_BROKER_URL`) succeeds with
`/app/subnetting` in the route list — pure web content, runs on the real
Vercel production deploy like forensics/networking before it.

Verified against the real dev Neon DB with a throwaway magic-link account
(same pattern as every prior content session — a token read from that
account's own `Verification` row via a disposable script, deleted after; no
browser-automation tool was available this session — the Chrome extension was
declined and an ephemeral Playwright download stalled, so this was done via
`curl` against the running dev server instead of a full click-through): the
real `/api/auth/magic-link/verify` endpoint was hit directly to obtain a
genuine session cookie (exactly what the app's own `/magic-link` page's
client-side `fetch` does — see auth-helpers.ts); `GET /app/subnetting` with
that cookie returned 200 with the real page (mode buttons, type-filter
options, Start button, the scope-honesty support line) and the RSC payload
showed `"bestAccuracy":null` for the fresh account; a disposable script then
exercised the exact `QuizProgress` upsert + `bestScore()` sequence
`recordQuickRound` performs directly against the real DB (60 → stays 60 on a
lower 40 → rises to 100 on a higher 100, proving the best-of logic); a second
`GET /app/subnetting` with the same cookie confirmed the page now serializes
`"bestAccuracy":100` and renders "Best quick-round accuracy". The throwaway
user and all its rows were deleted afterward. A full interactive
click-through (typing into the fields, seeing the worked solution render
live, clicking through a whole round in a real browser) was **not** done this
session for lack of a working browser-automation tool — flagged here
honestly rather than skipped silently; a human should do one manual
click-through before relying on this in production, same posture DECISIONS
020 took under the same constraint.

**035 · 2026-07-22 · Windows depth build — `docs/WINDOWS_DEPTH_SPEC.md`.**
Closes the last knowledge-pillar gap: Windows had a 25-item checklist and 14
drill cards but zero lessons, while Foundations/Networking/Forensics all had
full lesson tracks. Added 9 Windows lessons (`packages/content/lessons/
windows/*.mdx`) and 16 new drill cards (`cards/core.yaml`, 14 → 30 Windows
total), all mapped to existing `windows.*` taxonomy leaves — no new taxonomy
nodes needed (per the spec, everything already existed). Pure content, no
Docker, ships to production exactly like Forensics (031) and Networking
(033).

*No plumbing changes required — the infra was already domain-generic.*
`syncLessons`/`syncCards` in `prisma/seed.ts` already recursively scan
`packages/content/lessons/**` and the whole of `cards/core.yaml`, and
`validateSkillRefs`/`validateCardRefs` already validate any `windows.*` ref
since those nodes exist in `taxonomy.yaml`. `groupLessonsByDomain`
(`apps/web/src/lib/lessons.ts`) is already domain-generic — a "Windows" group
appears in `/app/lessons` automatically from the taxonomy's existing `Windows`
domain node, no index code change. `next.config.ts`'s
`outputFileTracingIncludes` already globs `packages/content/lessons/**/*.mdx`.
This session's actual work was authoring content, a factual-accuracy pass,
and updating docs.

*Lessons, sortOrder 1–9.* Account/password policy (the `net accounts`-can't-
set-complexity trap — length/age/history/lockout are real `net accounts`
switches, complexity needs `secpol.msc` or a `secedit` export/edit/import;
why reversible encryption is always critical), users/groups (unauthorized
users/admins, weak/never-expires passwords, Guest + built-in Administrator),
local policy/UAC/registry classics (audit policy feeding forensics, UAC to
`ConsentPromptBehaviorAdmin=2`, autologon/autoplay/password-reveal — export
before every edit), SMB/RDP hardening (SMBv1 = the WannaCry/EternalBlue
protocol, RDP disable-vs-require-NLA per README), Windows services (service
vs. process, the classic insecure-service list, never break a README-required
service), persistence/malware (Run/RunOnce/Startup folder, scheduled tasks,
`netstat -ano` for listening ports), Defender/firewall/updates (all **three**
firewall profiles — the common miss — plus `RealTimeProtectionEnabled` and
starting Windows Update early), shares/files/hosts (keep only the default
admin shares C$/ADMIN$/IPC$/print$, hosts-file poisoning since it's checked
before DNS), and an added Windows Server basics lesson (`level: advanced`,
mapping to the `windows.server.*` nodes: role minimization via
`Get-WindowsFeature`/`Remove-WindowsFeature`, why `net accounts` is
cosmetic on a domain-joined machine and the Default Domain Policy GPO is
what actually governs domain password policy, Domain Admins as the
domain-wide analogue of local Administrators, DNS zone records as the
domain-scale analogue of hosts-file tampering) — included after the user
opted in during planning (the spec had floated it as optional/deferrable).
Every lesson's commands were cross-checked against the already-verified
`windows-core.yaml` checklist (020/022's precedent: checklist commands were
the accuracy baseline) so lessons and checklist stay consistent; flipped
`published: false → true` in-session after this factual-accuracy read, same
precedent as Foundations (020) and Networking (033).

*Cards.* 16 new cards appended to the existing WINDOWS section of
`core.yaml`, prioritizing COMMAND per the spec (12 command, 4 concept),
covering skill nodes the original 14 cards didn't reach (weak-passwords,
guest-admin, audit-policy, registry-classics ×2, insecure-services ×2,
critical-services, persistence.artifacts, persistence.run-keys' RunOnce/
Startup variant, windows-update ×2, shares-ntfs ×2, and a second
account-policy.complexity card on reversible encryption specifically, distinct
from the existing net-accounts-complexity-trap card). They flow into the
daily drill through the existing enqueue paths unchanged
(`enqueueLessonCards`/`enqueueSkillNodeCards`).

Verified against the real dev Neon DB: `db:seed` created 9 lessons + 16 cards
on first run (all else unchanged), all-unchanged on a second run;
temporarily pointing a lesson's skill ref at a nonexistent taxonomy id failed
the run with exit 1 and a precise message, then reverted. `pnpm lint`
(eslint + tsc across all 3 workspaces) / `pnpm test` (171 `packages/db` + 157
`apps/web`, unchanged counts — pure content, no new logic) / `pnpm build`
(root, no `LAB_BROKER_URL`) all green, `/app/lessons`/`/app/lessons/[slug]`
routes present in the build output. Browser-verified against a real local dev
server + the real dev DB: `RESEND_API_KEY` is empty in this environment's
`.env`, so rather than a real magic-link email round-trip, a disposable
script created the exact `Verification` row Better Auth's magic-link plugin
itself creates (read from `better-auth`'s own `plugins/magic-link/index.mjs`
— plain-token identifier, `{email,name}` JSON value, 5-minute expiry) and hit
the real `/api/auth/magic-link/verify` endpoint directly — same effect as a
real email round-trip, no credentials involved, consistent with the
token-from-Verification-row pattern every prior content session used.
Confirmed: `/app/lessons` renders a "Windows" group with all 9 titles;
`shares-files-hosts` renders its share-types table as a real `<table>` (not
raw pipe text) with a working `overflow-x-auto` wrapper (the same
`mdx-components.tsx` table component 033 already proved doesn't overflow at
1024px) and all 3 check questions render as radio groups; a `LessonProgress`
upsert + card-enqueue exercising `submitCheck`'s exact DB writes moved
`shares-files-hosts` to 100% (confirmed reflected on a re-fetch of
`/app/lessons`) and enqueued its 3 active cards, all immediately due
(confirmed via a direct due-count query); `/app/drill` returned 200. The
throwaway user and all its rows were deleted afterward. A full interactive
click-through driven by a real browser (as opposed to direct HTTP +
disposable-script DB writes standing in for the browser's own form
submission) was not performed — no browser-automation tool was available in
this session, same constraint DECISIONS 020/034 already flagged; a human
should still do one manual click-through before relying on this in
production.

**036 · 2026-07-23 · Onboarding path Session 1: `docs/ONBOARDING_PATH_SPEC.md`
Parts D (Foundations content) + A (placement).** Turns the platform from a
library into the start of a path: Part D gives zero-knowledge users real
content to land on (`foundations.core.*` was 6 taxonomy leaves with nothing
authored against them); Part A gives the platform a way to ask who someone is
and route them there, non-punishingly. Parts B (recommended-track generation)
and C (dashboard "what's next") are explicitly **not** built this session —
next session, once placement + content exist for them to consume. Pure web
content/logic, no Docker — ships to Vercel production like every prior
content session (031/033/034/035).

*Part D — 6 Foundations lessons, sortOrder renumbered.* `packages/content/
lessons/foundations/{what-is-an-os,users-and-permissions,what-a-service-is,
ports-and-connections,passwords-and-policy,what-hardening-means}.mdx`, each
mapped to one previously-empty `foundations.core.*` node, OS-agnostic, zero
assumed prior knowledge, 3-question check apiece. Take `sortOrder` 1-6 as the
new prerequisite front of the Foundations lesson list; the 3 existing
competition-literacy lessons (scoring-engine, reading-a-readme,
safe-change-discipline) shift from 1-3 to 7-9 to sit after them — a beginner
should learn what a service *is* before learning how the scoring engine
treats one. No index/grouping code changes needed (`groupLessonsByDomain` is
already sortOrder-driven). 12 new drill cards appended to `cards/core.yaml`
under a new "FOUNDATIONS — core concepts" section (2 per node, all CONCEPT —
these are OS-agnostic ideas, not command syntax). Flipped `published: true`
after an in-session factual-consistency read against the already-published
Foundations/Windows/Linux lessons (the hashing/length-vs-complexity claims in
`passwords-and-policy`, the find-fix-verify loop in `what-hardening-means`
already matches `scoring-engine`'s and `safe-change-discipline`'s existing
language almost verbatim, by design) — same precedent as 020/033/035.

*Part A — placement bank is a dedicated multiple-choice bank, not the
existing exact-string quiz pools.* The spec's literal text says the knowledge
check is "drawn from the existing quiz content pools plus new placement-only
questions." Confirmed explicitly with the user before writing content: the
existing pools (`ForensicsQuestion`/`QuizQuestion`) are free-text
exact-string, have no difficulty tiers, and don't cover linux/windows at all
— retrofitting tiers onto two already-shipped content types, or mixing typed
recall into a first-contact beginner flow, was rejected in favor of a
purpose-built bank: `packages/content/placement/{foundations,linux,windows,
networking}.yaml`, multiple-choice (matches lesson-check's familiar,
low-anxiety UI), one file per domain, 7 questions each (3 foundations-tier +
2 standard + 2 advanced — the floor the ladder's worst-case single run
needs is 3/1/1; authored above it so a retake doesn't always show the
identical standard/advanced question). "I'm not sure yet" is **never
authored per-question** — the UI appends it as a sentinel (`NOT_SURE = -1`)
to every question, so it can't collide with an authored `answer` index and
is never framed to the user as a wrong answer, even though it nudges the
ladder easier internally exactly like a miss.

*No `PlacementQuestion` DB table.* Unlike every other question-bank content
type (forensics/quiz), placement questions are read transiently, server-side,
straight from the YAML at each step of the flow (`apps/web/src/lib/
placement-content.ts`, mirrors `forensics-content.ts`) — there's no
per-question user progress to index (no "best score per question"), so there
was nothing for a DB row to usefully back. The seed script still runs
`validatePlacementRefs`/`validatePlacementCoverage` (`packages/db/src/
placement/parse.ts`) so a bad skill ref or a too-thin domain fails loudly at
seed time with the usual discipline, just with 0 rows created — logged
explicitly as "0 DB rows (content-only, no sync)" so a future reader doesn't
mistake the missing count for a bug.

*The adaptive ladder (`packages/db/src/placement/ladder.ts`), pure and
heavily unit-tested (39 tests).* Domains are asked in a fixed block order —
all 3 foundations questions, then all 3 linux, then windows, then networking
— rather than interleaved, so the very first 3 questions are a coherent,
familiar block and the early-exit decision point (below) is unambiguous.
Within a domain: start at foundations tier; correct steps up one tier (capped
at advanced), incorrect or "not sure" steps down one (floored at
foundations); question selection is deterministic (first unused by
`sortOrder`), so a given answer history always produces the same next
question — no `Date.now()`/`Math.random()` anywhere in the module. Final
per-domain level is **the highest tier ever answered correctly, not wherever
the difficulty pointer ends up** — these can genuinely differ (a
regression-guarding test walks correct→wrong→correct and confirms the result
is FOUNDATIONS, not the STANDARD the pointer's final position would
suggest), because placement must reflect what was actually demonstrated.
**12 questions, 3 per domain** (not fewer) was a deliberate user call: with
only 3 draws per domain, every domain — including each machine — can still
walk foundations→standard→advanced and place at Advanced; a shorter check
would have capped strong competitors below their real level. `forensics` is
not assessed (Part A's Flow section only tests foundations/linux/windows/
networking) and carries no `Placement.levels` entry — it's a technique
pillar, not a machine track.

*The early-exit off-ramp, added mid-session per explicit user direction.*
After exactly the first question (foundations domain, foundations tier), if
it was missed or answered "not sure," `nextStep` returns the *next* question
already fetched, tagged `offerEarlyExit: true` — an offer the flow may
present, never an automatic cutoff. Accepting it (`placement-flow.tsx`'s
"That's all we need — start me at the beginning") calls `advancePlacement`
with `endEarly: true`, which short-circuits straight to `earlyExitLevels()`
(every domain FOUNDATIONS) without running the remaining ladder — "keep
going" just dismisses the offer and shows the already-fetched question, no
extra round trip. `offerEarlyExit` is true at exactly one point in a run
(unit-tested): never on the first question itself, never again after a later
miss.

*Storage: one `Placement` row per user, no question-bank table (above),
typed `TrackLevel` per domain rather than a bag of strings.* Additive
migration `add_placement`: `experience`/`focus` are `String`/`Json`
(self-report, no fixed enum benefit for a one-time answer set); `levels` is
`Json` keyed by the 4 assessed domains, each value one of the existing
`TrackLevel` enum's string forms; `answers` is the full re-derived
`PlacementAnswer[]` history (never the client's own claims) kept for
auditability. `userId` is `@unique` (not a separate re-take history table) —
re-taking overwrites in place, matching the spec's "re-takeable" requirement
without accumulating rows nobody reads. Prisma's `Json` input type wants a
plain string-indexed object; casting a typed `PlacementAnswer[]` into it
needed one explicit structural cast in `actions.ts` (the fields are already
JSON-safe, only the nominal interface trips the check) — not a
`JSON.parse(JSON.stringify(...))` round trip, to avoid an unnecessary
serialize/deserialize on every write.

*Stateless server actions, client holds the running answer list.*
`advancePlacement` (`apps/web/src/app/app/placement/actions.ts`) re-derives
and re-grades the **entire** answer history from the content-as-code bank on
every call via `recordPlacementAnswer` — trusting only `questionId` +
`choice` from the client, never a claimed domain/tier/correctness — the same
discipline lesson checks/forensics/quiz grading already use. No
in-progress-placement DB row exists; the client resubmits its whole answer
array each step, mirroring the subnetting trainer's re-derive-from-seed
pattern (034) rather than the alternative of a session/state table.
`placement-flow.tsx` deliberately imports nothing from `@roundzero/db`
(including types) — that package's `client.ts` constructs a real
`PrismaClient` at module scope (034's exact concern), so even a `NOT_SURE`
sentinel constant is duplicated as a plain literal in the client file rather
than imported, matching `quiz-runner.tsx`'s existing precedent of not
touching `@roundzero/db` from a `"use client"` file at all.

*Copy discipline, enforced structurally, not just by wording.* No
`ScoreLine` (not a scored round, 029's reasoning), no per-question
correct/incorrect reveal during the check itself (unlike the quiz engine —
placement is a placement instrument, not a practice quiz), and the result
screen renders **only** the per-domain level lines — no score, no
correct-count, no tally of any kind ever reaches the DOM, so there's no
right/wrong signal left to leak through even by accident. Verified directly:
the disposable end-to-end script asserts the rendered result HTML contains no
`N / 12`-shaped substring.

*Extended `TX_OPTIONS` timeout across every `seed.ts` transaction, found
mid-session.* Bumping 3 lessons' `sortOrder` alongside creating 6 new ones (9
lesson writes in one interactive transaction) hit Prisma's 5s default
interactive-transaction timeout against this environment's Neon round trip
(~230ms warm, ~2.1s on a cold first query — measured directly, not guessed).
Added a shared `TX_OPTIONS = { timeout: 20_000 }` applied to all six
`prisma.$transaction` calls in `seed.ts`, not just the one that hit it, so
the next content-heavy session doesn't rediscover the same failure mode.

No new dependency. `pnpm test` (210 `packages/db` — 171 + 39 new placement
unit tests covering the ladder's stepping/clamping/selection/early-exit/
level-mapping behavior and the bank parser's validation — + 157 `apps/web`,
unchanged) / `pnpm lint` (eslint + tsc across all 3 workspaces) / `pnpm
build` (root, CI placeholder env, no `LAB_BROKER_URL`) all pass, `/app/
placement` present in the build's route list. `pnpm db:seed` run three times
across the session's edits (lessons, then cards, then the published flip),
each reporting the correct create/update counts on first run and
all-unchanged on the next; temporarily pointing a placement question's
`skillNodeId` at a nonexistent id was not separately re-verified this session
(the parser/validator's behavior for that case is unit-tested directly,
matching the precedent every other content type's seed-fail-loudly check
already established). Browser verification used the disposable-account
pattern from every prior content session (magic-link token read from its own
`Verification` row, no real credentials, all rows deleted after) driven via
direct HTTP + a script calling the exact same exported `ladder`/`grade`
functions the server actions call — no browser-automation tool was available
in this session either (020/034/035's same constraint): confirmed a fresh
account sees the self-report step; an all-"not sure" run places every
assessed domain at FOUNDATIONS with the early-exit offer firing after
question 1 and warm, tally-free result copy; an all-correct run (after
retaking) places every domain at ADVANCED, proving no domain is capped below
it; retake truly resets to the self-report step; and completing the
`what-is-an-os` lesson's check persists a 100% `LessonProgress` and enqueues
its 2 drill cards, due immediately. A human should still do one manual
click-through (typing into the actual radio/checkbox UI, confirming focus
rings and the early-exit interstitial render correctly) before relying on
this in production, same posture as every prior no-browser-tool session.

**037 · 2026-07-26 · Onboarding path Session 2: `docs/ONBOARDING_PATH_SPEC.md`
Parts B (recommended-track generator) + C (dashboard "what's next" +
progress).** Turns the platform from a library-with-placement into a guided
path: a pure function derives an ordered queue of next-steps from placement +
progress + content, and `/app` becomes a real dashboard that surfaces it.
Extends 036 (which shipped Parts D + A). Pure web logic + UI, no Docker, no
schema change (the track is derived on read; `Placement` and every progress
model already existed) — ships to Vercel production like every prior content
session.

*Part B — the generator is pure and lives in `packages/db/src/track/
generate.ts`, a sibling of `placement/ladder.ts`.* Same discipline as the
ladder: no DB/fs/framework imports, heavily unit-tested (57 tests), total
(returns a non-empty queue for every valid input). `generateTrack(input)` →
`TrackStep[]` where a step is `{kind: lesson|drill|quiz|subnetting|checklist|
lab, ref, title, reason, status}`. The Prisma + content glue
(`apps/web/src/lib/track.ts`: `loadTrack`, `loadPillarProgress`, `hrefForStep`,
`normalizeFocus`/`normalizeLevels`, `toStepView`) loads the inputs and resolves
routing — exactly how `loadDrill` wraps the pure `dueCards`/
`selectNewFoundationsCards`. Routing (`hrefForStep`) is kept OUT of the pure
function so it stays framework-free. The generator is **derived on read**
(spec's explicit call): always fresh, no persistence, no staleness bugs.

*The five generation rules, implemented literally.* (1) **Foundations gate** —
if `levels.foundations === FOUNDATIONS` (a beginner, or a null/un-placed user
treated as one), the queue always leads with the incomplete Foundations
lessons in sortOrder; an expert placed ≥ STANDARD in foundations never sees
them (also excluded from the rule-5 expansion pool). (2) **Focus machine** —
`focus` maps `cisco → networking`, `unsure`/empty → all machines in a fixed
Linux→Windows→Networking order; each focus domain's lessons are filtered to
**level ≥ that domain's placement level** and ordered by (levelRank,
sortOrder). This "≥ level, sortOrder-ordered" window (signed off by the product
owner over a strict single-tier slice) honors "at or just above" in practice —
sortOrder already sequences difficulty, advanced sorts last — while keeping
rule 5 clean (the queue naturally holds everything up to the top tier). (3)
**Interleave** — after every 2 lesson steps, a drill step (only if cards are
due) and, for a networking run, the subnetting/networking trainer; a small
dedupe prevents identical practice steps stacking. (4) **Lab gate** — robust to
an empty prerequisite set (the amendment the product owner caught: today's repo
has ZERO Linux lessons, so "all Linux fundamentals complete" would be vacuously
true and surface the lab to a cold beginner — the opposite of the rule's
intent). `linuxLabReady` prefers real content: if any Linux lessons at
FOUNDATIONS/STANDARD exist, the gate is "all of them complete"; while none do,
a proxy stands in — `linuxLevel ≥ STANDARD` OR every published Foundations
lesson complete. A total beginner gets no lab; a diligent beginner who finished
Foundations, or anyone with demonstrated Linux ability, does. When Linux
lessons are added later the real gate takes over automatically. Both branches
are unit-tested explicitly so this can't regress. The lab step is always
`status: "available-when-runnable"` (the lab is local-only and not wired on the
hosted deploy, DECISIONS 027/031) so the track presents it honestly, never as a
link that dead-ends. (5) **Never empty** — when the focus queue is exhausted,
expand to non-focus machines' incomplete lessons, then a keep-sharp floor
(drill + checklist + a forensics quiz), so a fully-complete expert gets "here's
what's next," never a dead end.

*Part C — `/app` is now the dashboard for everyone (was a thin gate that
redirected members to `/app/team`).* Removed that redirect (sign-in already
lands on `/app`, so the dashboard is now the post-sign-in home). It renders:
a warm, **non-blocking** placement invite for un-placed users (primary "Start
placement" + an explicit "Skip and browse everything" escape); a "Next up" hero
(top 3 track steps as single-click `NextStepCard`s, each with its plain
`reason`); a "Today" `StatStrip` (cards due, drill streak, "Currently on"); a
compact cross-pillar progress view (Foundations + the 4 machines/forensics,
honest lesson counts + real quiz averages, a neutral/accent completion meter —
**never `--score`**, which stays reserved for real scores per DESIGN.md, signed
off); and team + browse-everything affordances. Team setup (`TeamChooser`) moved
to `/app/team` for non-members (it used to live on `/app`), so nothing is lost
by the redirect removal. `loadTodaySummary` (drill.ts) computes the streak
read-only — deliberately NOT `loadDrill`, whose new-card top-up is a write that
must stay a side effect of visiting `/app/drill` itself, not every dashboard
load.

*Inline "Next up" everywhere a task ends.* A shared `NextStepCard` /
`NextStepInline` (`apps/web/src/app/app/next-step-card.tsx`) — an app-level
composition of `packages/ui` tokens, NOT a new primitive (DESIGN.md rule 3,
signed off) — renders on the dashboard AND inline after finishing a lesson
check, a quiz (forensics + networking, via the shared `QuizRunner`), the drill,
and the lab debrief, so a completed task points forward instead of dumping to
an index. It is **client-safe**: it takes a fully-resolved, serializable
`NextStepView` (href computed server-side) and imports only TYPES from
`@roundzero/db`, so a `"use client"` surface rendering it never pulls Prisma
into the client bundle (the 034/036 concern). The lesson page passes the
just-finished slug as `alsoCompleted` to `loadTrack` so its inline "Next up" is
the *following* step without a revalidation round trip; the drill and lab filter
out their own kind so they don't recommend themselves.

*Copy discipline (spec's non-negotiable).* Plain, warm, never gamified or
ranking: "You placed at Standard for Linux — Standard lesson," "Start here —
this builds the vocabulary everything else uses," "Honest completion across
every pillar — no points, no rank." No streak-as-pressure (a 0 streak renders
"—", not a shaming zero), no XP, no Lucide-icon-free emoji.

No new dependency, no migration. `pnpm test` (267 `packages/db` — +57 track
generator tests covering the foundations gate, the level window, the interleave
cadence/dedupe, the empty-prereq AND lessons-present lab gates, queue
advancement, and never-empty across a focus × levels × completion matrix — and
165 `apps/web` — +8 track-glue tests for `hrefForStep`/normalize/pillar
aggregation), `pnpm lint` (eslint + tsc across all 3 workspaces), and `pnpm
build` (root, CI placeholder env, no `LAB_BROKER_URL`) all pass, with `/app`
and every route in the build output. `pnpm db:seed` reported all-unchanged
(no content touched this session).

*Verification level, stated honestly (same posture as 020/034/035/036).* The
track generator's correctness is covered by the 57 unit tests PLUS a disposable
throwaway-user run against the real dev Neon DB that replicated `loadTrack`'s
exact Prisma queries + normalization and drove `generateTrack` across all three
dashboard states with real content (27 published lessons, 9 Foundations):
brand-new (no placement → invite, top step = first Foundations lesson, no lab),
mid-progress (placed, first 2 Foundations done → queue advances to the 3rd),
and completed (all lessons done + expert placement → non-empty keep-sharp floor,
no dead end). The dashboard and completion surfaces WERE verified rendering in
a real browser engine this session (unlike 020/034/035/036, which had no such
tool): a local dev server on `:3000` with a genuine minted session (the exact
magic-link `Verification` row the plugin creates — `storeToken: "plain"`, so
identifier == token — then the real `/api/auth/magic-link/verify` endpoint)
returned HTTP 200 for `/app` with every section present (greeting, Next up,
Today, Where you stand, all pillars, browse); the placement invite correctly
showed for an un-placed user and disappeared once a `Placement` row existed
(with "Currently on" then present); `/app/team` rendered the `TeamChooser` for a
non-member; and all four completion-surface pages (`/app/lessons/[slug]`,
`/app/forensics/[archetype]`, `/app/networking/[category]`, `/app/drill`,
`/app/lab`) returned 200 with their added `loadTrack` calls. What was NOT
browser-verified: a full interactive click-through (actually completing a
lesson check / quiz / drill in the UI and watching the inline "Next up" appear
via client state, and keyboard/focus-ring/reduced-motion behavior on the new
surfaces) — those inline strips are behind client interaction that curl can't
drive, and the product owner opted to verify the dashboard visually on the
production deploy themselves. The throwaway user + all its rows were deleted
afterward. A human should still do one manual interactive click-through of the
inline "Next up" strips before fully relying on them in production.

**038 · 2026-08-10 · Track step reasons are authored per lesson in
frontmatter, not generated per bucket; dashboard "Next up" becomes a
hierarchy instead of three equal cards.**
`generateTrack` built a step's `reason` inside the loop that queued it, so
every Foundations lesson shared one literal ("Start here — this builds the
vocabulary everything else uses."), every focus-machine lesson shared a
placement restatement, and every expansion lesson shared a third. A brand-new
user's top three cards were therefore three copies of one sentence — the
reported bug. The type comment claimed "why this, why now"; the code
delivered "why this bucket". Fix: `why` is now a REQUIRED lesson frontmatter
field (27/27 authored, all distinct, all under 110 chars), parsed and
validated by `parseLesson`, and all three per-bucket constants are deleted.
The single remaining generic string, `FALLBACK_LESSON_REASON`, is
unreachable for well-formed content and fires an `onMissingWhy(slug)`
callback when used — the generator stays pure, apps/web logs the warning.
Tests assert the top three steps carry three distinct reasons, that no two
lessons ever share a reason, that no two ADJACENT steps share one, and that
the fallback fires exactly zero times across every focus × level × completion
combination.

`why` is read from `packages/content` at request time, NOT added to the
`Lesson` table: `LessonRow` explicitly omits it, so the seed and schema are
untouched. Rationale is CLAUDE.md's own rule — "DB rows are an index of
content, never the source of truth for it" — and the practical consequence
that the field ships with no migration and no deploy-ordering hazard against
the production DB. `lesson-content.ts` gained a process-lifetime memoized
index because the old linear scan (readdir + parse every file until the slug
matched) would have run per queued lesson; the lesson page gets that speedup
too. One production-only trap this created and closed:
`outputFileTracingIncludes` shipped lesson MDX only for `/app/lessons/**`,
but `loadTrack` is called from six routes, so the include now covers the
whole `/app` subtree — without it those functions would have ENOENT'd on
Vercel while building fine locally.

Screen-craft fixes shipped in the same pass, all on the dashboard: `Next up`
is now one dominant hero (real "Start lesson" primary action, capped 62ch
measure) plus ordinal-numbered compact rows, because three identical cards
read as a menu when they are a sequence; the eyebrow carries pillar + honest
minutes instead of the kind already shown by the icon; a step with status
`available-when-runnable` (the lab) is no longer wrapped in a `<Link>` at all
— it previously rendered a "Runs locally" chip inside a live link that
dead-ends on production, which is exactly what the status exists to prevent.
New `SectionHeader` primitive in `packages/ui` fills the 20/28 section-title
tier DESIGN.md specifies but nothing rendered: screens had been using
`<Eyebrow as="h2">`, making section headings 11px caps — smaller than the
14px support line beneath them, inverting the hierarchy the checklist asks
for. `Stat` gained `mono` (default true) so "Currently on" stops typesetting
a lesson title in mono with tabular figures, and that value is now a link
(it was the likeliest click target on the row and inert). Today's empty
values recruit rather than report failure ("None due yet" + "Your first
recall cards are waiting…") and the section sits in a card instead of reading
as loose text. Pillar rows use a segmented per-lesson meter rather than a
progress bar, because a 0% bar rendered a full-width `--hairline` track that
read as nearly complete; ticks also make every row exactly two lines tall,
fixing the ~7px jitter between rows with and without a meter. `Where you
stand` gained the one aggregate number it lacked ("2 of 27 lessons").
Motion is single-sourced because three surfaces had silently fallen back to
Tailwind's default easing by omitting it. `--ease-standard` goes in `@theme`
— `--ease-*` IS a Tailwind v4 namespace and generates `ease-standard`. There
is NO `--duration-*` namespace, though: declaring one compiles to nothing,
so the first cut of this left every element carrying `duration-standard`
with no transition-duration at all — hovers became instant rather than
150ms, a regression invisible to tests, typecheck, and lint alike. Caught by
compiling `globals.css` through PostCSS and asserting the utility is
actually emitted; `duration-standard` is now an explicit `@utility`. Worth
remembering: a Tailwind v4 theme variable in an unrecognized namespace fails
silently, so any new token should be checked against compiled output rather
than assumed. A global `prefers-reduced-motion` block plus `motion-safe:` on
the arrow transforms implements DESIGN.md's reduced-motion rule, which had
only ever been honored inside CountUp and RunTrajectoryChart. `avg()`
returns null instead of `Math.round(0/0)`.

Verified this session: 446 unit tests pass (278 in packages/db, 168 in
apps/web), ESLint clean on every changed file, `packages/ui` typechecks
clean, and an end-to-end run of the real generator over the real 27 published
lessons in the exact brand-new-user state (no placement, nothing completed,
no cards due) produces three distinct reasons with pillar + minutes and zero
fallback hits. NOT verified this session, and the reason is environmental:
the sandbox has no DNS to Neon and `binaries.prisma.sh` returns 403, so
`prisma generate` could not run — meaning `next build`, a full `apps/web`
typecheck against the real client, and any browser render were impossible
here. The remaining `tsc` output in apps/web is entirely implicit-any noise
from a hand-written Prisma stub used to let the pure tests import, and every
file changed in this pass is clean of it. A human should confirm the Vercel
production build and click through `/app` — in particular the hero's
keyboard focus ring, the reduced-motion behaviour, and the lab card's
non-link state — before relying on this.

**038a · 2026-08-11 · Follow-ups to 038, from reviewing the shipped result.**
Two accent-bordered `p-6` cards rendered stacked for a brand-new user (the
placement invite and the new Next up hero), so neither read as the answer to
"what now" — the hero takes a `muted` prop that drops the accent border and
icon tint while `!hasPlacement`, and the two cards now share one alpha
(`accent/30`) instead of 30 and 40. `Button` was still carrying
`duration-150 ease-[cubic-bezier(...)]` inline, the exact drift the motion
tokens exist to prevent; it uses `duration-standard ease-standard` now.
Pillar + minutes no longer hide below 640px on compact rows — that hid the
information the eyebrow exists to carry. And "Currently on" is now "Last
completed": it had been `steps.find(kind === "lesson")`, i.e. the first step
of the track, which for a new user is literally the hero's own title
restated below it. Looking backward is the only one of the two a user can't
already see on this screen. Deploy of 7aa8cf4 confirmed READY in production
before these landed.

**038b · 2026-08-11 · Render tests for the next-step card's un-clickable
state.** The `available-when-runnable` lab card can only be reached by an
account whose track is lab-ready, so live click-through never covers it —
which is how it shipped as a "Runs locally" chip inside a live `<Link>` in
the first place. `next-step-card.test.tsx` asserts the contract directly
(13 tests): a non-runnable step renders no anchor and no trailing arrow, the
hero offers only an explainer link instead of a primary action, the eyebrow
carries pillar and omits time rather than inventing it, the ordinal renders,
and the hero's accent drops under `muted`. Each assertion was mutation-
verified — reverting the fix in a scratch copy fails precisely the test
written for it and nothing else.

**039 · 2026-08-13 · The checklist trio: fork editing, diff, print
(ROADMAP step 1.2).** Server actions, editing UI, diff view, and print
export on top of the pure fork/diff/reorder logic from `fork.ts` (commit
`393427b`, no DECISIONS entry of its own).

*Migration, corrected from the spec.* `TeamChecklistItem.action` was `String`
(NOT NULL) while `why`/`commands` were nullable — an oversight, not a design
choice; `fork.ts`'s already-tested logic assumed all three were nullable
(`initialForkItems()` writes `action: null` on every row). Migration
`20260813014903_make_team_checklist_item_action_nullable` is a single
`ALTER COLUMN "action" DROP NOT NULL` — additive, backwards-compatible
(existing non-null values stay valid; no deployed code path ever writes
`null` yet), and was run directly against the same Neon instance Vercel
serves from (`.env`'s `DATABASE_URL`), confirmed with no deploy in flight at
the time and no production forks yet to backfill. This corrects CLAUDE.md's
and `fork.ts`'s header comments, which both claimed no migration was needed.
Widening a nullable constraint ahead of the code that relies on it is safe
in general, but is exactly the kind of change that must never land while a
deploy is mid-flight — the migration and the code that depends on it should
be treated as one unit even though Vercel and `prisma migrate dev` are two
separate, un-sequenced steps here.

*Authorization.* One chokepoint, `requireForkEditor()` in
`apps/web/src/app/app/checklists/actions.ts`, run by every mutation: session
→ same-organization membership → `canEditTeamChecklist(role)` (new in
`lib/teams.ts`, coach or captain — extends the existing `canManageRoster`
pattern rather than duplicating it). Enforced server-side; a member invoking
an action directly is refused exactly like one who never sees the button.

*Null-means-inherit, whole-map for `commands`.* Every write to an
upstream-linked field goes through `overrideOrNull`/`commandsOverrideOrNull`
(new `apps/web/src/lib/checklist-fork.ts`), which store `null` — not a copy
— when the value equals upstream. `commands` is a `Record<string, string>`
keyed by OS variant, not a single string, and the override is the WHOLE map:
editing one variant resubmits every variant, edited and not, because a
partial map would make untouched variants vanish on resolve (`resolveFork`
only falls back to upstream when the entire field is `null`). Revert always
clears the whole field. `revertForkItemField` is shared verbatim between the
fork editor's "Revert to upstream" and the diff view's "Accept upstream" —
same write, two names for two contexts.

*Print: browser print, no PDF dependency.* `/app/checklists/[id]/print`
renders the `field datasheet` identity (DESIGN.md, DECISIONS 013) and relies
on the browser's own print-to-PDF, per golden rules 4 and 7. DESIGN.md gains
a documented `--paper-*` token table (it previously only gestured at "warm
light" with no values) — `--paper-bg`/`-surface`/`-surface-2`/`-hairline`/
`-text`/`-text-dim`, all checked for AA. Implementation is a `.datasheet`
CSS scope in `globals.css` that reassigns the base `--bg`/`--surface`/
`--hairline`/`--text`/`--text-dim` tokens to the paper values *within that
scope*, rather than a `@media print` swap — every `packages/ui` component
built against the base token names (Badge, Button, the new Checkbox) renders
correctly on paper with zero print-specific variants of its own, and the
in-browser preview already matches what prints. `.app-shell-content` (the
app shell's centered column) drops its max-width/padding under
`@media print` so the datasheet uses the full physical page instead of
shrinking inside the on-screen reading column.

The print header's version line shows the TEMPLATE's current version as
authority, with the fork's `sourceVersion` appended only when it differs
(`versionLabel()`) — `resolveFork` merges every inherited field against
current upstream, so a fork made at v1 already prints v2-derived text once
upstream has moved on, and printing "v1" unqualified on a load-bearing paper
artifact would be a correctness bug, not a cosmetic one. The record ID
(`formatRecordId()`) needs a team name and slug the print route may not
have — a signed-in viewer with no team membership still gets a real header,
`NO_TEAM_NAME`/`NO_TEAM_SLUG` ("Unaffiliated" / "no-team"), never a blank
slot (DESIGN.md: no placeholder voids).

*Reorder and restore.* `moveForkItem` reorders only the visible (non-removed)
set through the already-tested `reorder()`; a removed row keeps whatever
`sortOrder` it had when hidden. Display and print numbering are always the
item's position in the filtered, sorted list — never the raw `sortOrder`
value — so the gap removal leaves behind is harmless. Restoring a removed
row does not renumber it back to a specific position: it re-enters the
visible set at its old `sortOrder`, landing wherever the `[sortOrder, id]`
tie-break puts it. Deterministic, not a promised adjacency to its former
neighbours.

*New `packages/ui` primitives:* `Textarea` (Input's styling, resizable —
`packages/content/checklists/linux-core.yaml` confirms real commands are
multi-line with comments, so a single-line `Input` wasn't enough) and
`Checkbox` (explicit-border box rather than the UA-painted control, so the
same component is also the print datasheet's pen-checkable box).

Verified: `pnpm lint && pnpm test && pnpm build` green after each of the
four commits (507 unit tests total across `packages/db` and `apps/web`,
23 of them new in `checklist-fork.test.ts`). Also verified via browser
walkthrough against the running dev server: fork creation (every item
resolves `origin: upstream`), a per-field edit (only the edited field pins;
its sibling field keeps inheriting; the revert affordance appears only on
the pinned field), the diff link's clean/dirty gating, the `/diff` redirect
when there's no fork, and the print surface (warm-paper identity, ≈14.5:1
and ≈5.58:1 text contrast, dense 1..n numbering, checkboxes, wrapping mono
commands, app chrome hidden). Keyboard-only reorder, remove/restore, and the
`member`-role refusal check are covered separately.

**039a · 2026-08-13 · Fixed a false-positive in `diffFork`'s conflict
detection, found by inspection before any real fork existed to hit it.**
`updatedConflicting` was computed as "override != current upstream" — which
is also true of every deliberate customization a team makes, since a team's
own wording is *supposed* to differ from upstream. The category would have
flagged every edited field as "upstream changed, accept the correction"
forever, whether or not upstream had actually moved. Fixed by giving each
overridable field a snapshot of what upstream said the moment it was
overridden (`TeamChecklistItem.actionSnapshot` / `whySnapshot` /
`commandsSnapshot`, all nullable, migration
`20260813034525_add_team_checklist_item_upstream_snapshots` — additive,
same safety profile as 039's, applied directly to the same production Neon
instance with no deploy in flight). A conflict is now snapshot != current
upstream, computed in `fork.ts`'s `diffFork`; a missing snapshot (an
override with no recorded snapshot — there is no such row yet in
production, but there will be for any row written before this migration)
is treated as an ordinary customization, never a conflict, per the same
"can't tell, so don't guess" principle DESIGN.md already applies elsewhere.
`snapshotFor()` (new, `apps/web/src/lib/checklist-fork.ts`) is the one
place a snapshot gets written: null override → null snapshot, a real
override → the current upstream value, called from `updateForkItemText`/
`updateForkItemCommands` alongside the override itself, and cleared
alongside it in `revertForkItemField`. `fork.test.ts` gained two regression
tests (a deliberate customization must not read as a conflict; an override
with no snapshot must not either) plus an update to the existing
"upstream change hidden underneath a team override" test, which needed a
snapshot to actually exercise the code path it was named for — that test
was passing before this fix for the wrong reason.

**040 · 2026-08-18 · Coach setup wizard (`/app/team/setup`): team → invite →
cadence → plan. Step 1.4 of the locked build order.** The roadmap line reads
"season plan generated from `Season` calendar data," which cannot be built as
written — `seed.ts` only ever creates the `Season` row (`cp-19`); no
`SeasonEvent` rows exist for a generator to read. Round 1 / Round 2 / State /
etc. dates are real facts the AFA publishes each season; hardcoding guesses
would put wrong information in front of coaches and would later drive the
Phase 6 integrity lockout windows (`SeasonEvent.lockout`) off invented data —
a correctness bug, not a cosmetic one. **Resolved by inverting the roadmap
line: dates are coach-entered, not generated**, and stored as ordinary
`SeasonEvent` rows so the generator (whenever it's built) has real data to
read. Seed-shipped official rows can land later without any wizard change —
see the calendar-resolution rule below.

*Team-scoped dates: an additive migration, against the spec's stated default
of none.* `SeasonEvent` hung off `Season` only, and `Season` is global
(`cp-19`, shared by every team this season). Writing a coach's guessed Round 1
date onto that shared row would make one team's typo every team's calendar,
let two coaches overwrite each other, and would feed Phase 6 lockout logic
from cross-tenant data. The alternative that needed no migration — a
per-team private `Season` row with `Organization.seasonId` pointing at it —
was rejected too: it makes `Season` two different things and muddies
`Season.active` and the official-catalog meaning for every other reader of
that table (`/app/checklists` already displays `season.title` as if it's
always the one official season). Migration
`20260818214852_add_team_season_events_and_meeting_cadence`, applied directly
to the production Neon instance (same safety profile as 039/039a — nullable,
additive, no backfill), adds:
- `SeasonEvent.organizationId String?` (+ `@@index([seasonId, organizationId])`)
  — null = official/seed-shipped, visible to every team; set = one team's own
  row, visible only to them.
- `Organization.meetingCadence MeetingCadence?` and `.meetingDay Weekday?` —
  see below.

**Calendar resolution rule, load-bearing:** `resolveTeamCalendar()`
(`apps/web/src/lib/season-plan.ts`) collapses a season's rows to at most one
per `EventKind` — a team's own row for a `kind` always wins over the official
row of that same `kind`, never both shown. Without this, a coach who entered
Round 1 by hand would see two Round 1 rows the day an official one is seeded.
Covered by a two-organization test asserting org A's rows never appear in org
B's resolved calendar (`season-plan.test.ts`) and by `actions.test.ts`
asserting every write is scoped to the caller's own `organizationId`, never a
form-supplied one.

*Cadence: typed `Organization` columns, not `metadata`.* Original direction
(agreed with the user before implementation) was to fold "how often does your
team meet" into `Organization.metadata` — a JSON string field Better Auth
itself owns on the org schema. Changed during implementation: `metadata`
is the org plugin's own field, so writing our data into it means a
read-modify-write merge on every save and a zod parse that has to tolerate
the plugin someday writing its own shape there — exactly the fragility the
user flagged as a reason to prefer a migration instead. `Organization`
already carries `division`/`joinCode`/`seasonId` as real columns marked APP
FIELD; `meetingCadence`/`meetingDay` follow that existing convention instead
of introducing a second, JSON-shaped one. Folded into the same migration as
`SeasonEvent.organizationId` above, so it cost nothing extra. This is a
deviation from the metadata approach as originally selected — recorded here
per the instruction to do so if taken.

*Resumability is derived from DB state, never a stored cursor.*
`resolveSetupStep()` reads `{ hasTeam, memberCount, hasCadence, hasAnyDate }`
straight from the DB: no team → 1; team but roster of one → 2; roster but no
cadence/dates → 3; otherwise → 4. A bare `/app/team/setup` visit (closing and
reopening the tab) always lands on the right step because the *data* says
where the coach left off. `?step=N` is a view cursor only, for a coach who
wants to jump back and revise a finished step — it is never written to the
DB, and a stale `?step=1` on a team that already exists bounces forward to 2
rather than trying to re-run team creation.

*Roster progress is aggregate-only.* Step 4's "lessons by pillar" shows a
count — "1/4 members through" — never which members, and never a
per-student table. CLAUDE.md rule 8 (data minimization for minors) and
DESIGN.md's "no points, no rank" apply here exactly as they do to the
dashboard's own pillar view; a per-student breakdown on a coach's screen is a
leaderboard regardless of what it's named. **Definition, stated in a code
comment on `derivePlan()` so a future session doesn't re-derive it
differently:** a member is "through" a pillar once they have a
`LessonProgress` row for *every* currently-published lesson in it — not
"has started," not an average score. A pillar with zero published lessons
counts nobody as through.

*A client component may not value-import anything that reaches Prisma or
Node's `fs`, even transitively through a shared "pure logic" module —
discovered mid-session as a real Turbopack build failure, not a lint nit.*
`cadence-form.tsx` (`"use client"`) originally imported `EVENT_KIND_LABELS`/
`EVENT_KIND_ORDER` as values straight from `lib/season-plan.ts`. That module
itself has no Prisma import, but it value-imports `PILLAR_LABELS`/
`PILLAR_ORDER` from `lib/track.ts` — which value-imports `prisma` and
`lib/lesson-content.ts` (`readdirSync` from `node:fs`) — so the whole chain
got pulled into the browser bundle and `next build` failed with "the
chunking context (unknown) does not support external modules (request:
node:fs)". A `"use server"` file's own value imports of `prisma`/`auth`
(e.g. `checklists/actions.ts`, this wizard's own `actions.ts`) are NOT the
same hazard — Next compiles a `"use server"` export to a client-side
reference stub, so its real body and imports never ship to the browser; that
pattern was already proven safe in production and needed no change here.
Fixed the same way `next-step-card.tsx`'s `NextStepView` already does
(DECISIONS 034/036): `cadence-form.tsx` now takes fully-resolved,
serializable props (`dateFields: { kind, label, initialValue }[]`) from its
Server Component parent (`page.tsx`, which freely imports the real
constants — server pages are never bundled for the browser) instead of
importing anything beyond `import type { EventKind }`, which is erased at
compile time. `lib/season-plan.ts` was also split from its Prisma loaders
(`lib/season-plan-loaders.ts`) to keep the pure module itself free of any
`prisma` import — the same pure-module/thin-Prisma-layer split `lib/track.ts`
uses, just as two files instead of one section within one file, because
(unlike `track.ts`) this module's pure exports needed to be safely
client-importable.

*New `packages/ui` usage, no new primitive.* The six date fields use `Input`
with `type="date"` as-is — `globals.css` already sets `color-scheme: dark`
on `:root`, so the native picker (including its calendar icon) renders
correctly without any extra CSS.

Verified: `pnpm lint && pnpm test && pnpm build` green (305 tests in
`packages/db`, 250 in `apps/web`, including new coverage in
`season-plan.test.ts`, `teams.test.ts` (`canRunTeamSetup`), and
`setup/actions.test.ts` — the last covers the spec's required server-side
refusal check, invoking the action directly rather than observing a hidden
button, plus org-scoping against a form-supplied `organizationId`).

**040 · 2026-08-19 · RoundZero is an individual training platform. Coach
tools cut, teams dormant, focus lives on placement.** The unit is one person
training and improving — not a team, class or club. Consequences, all
deliberate: (a) coach tools are REMOVED from the roadmap, not deferred —
assignments, coach dashboard, scrimmages, coverage matrix, group readiness
reports, and the coach setup wizard. `docs/spec.md` §8 and the original
Phase 3 are superseded and should be read as history. (b) The coach setup
wizard, built and browser-verified in this session, was reverted rather than
committed. Committing a feature already decided against is how it gets
"helpfully" extended three sessions later; nothing depended on it. Its
migration (`SeasonEvent.organizationId`, `Organization.meetingCadence`,
`Organization.meetingDay`) had already been applied to production and is left
in place — three nullable columns nobody writes to are cheaper than a
reverting migration. (c) Teams go DORMANT, not deleted. `Organization` is
Better Auth's model via the organization plugin (DECISIONS 004), so removal
is an auth-layer change on working sign-in; and `TeamChecklist` is scoped by
`organizationId`, so removal means re-scoping and re-migrating the fork/diff/
print trio shipped hours earlier. A "team checklist fork" and "my customized
checklist" are one feature with a different owner column — a cheap rename
later if it ever matters, not a reason to demolish working code now. Dead
code is cheap; an auth migration plus a fork re-scope is not. (d) Machine
specialization survives the cut but moves off the team model entirely.
`Placement.focus` is user-scoped and already carries it; `Member.machineRole`
goes dormant. Verified during this decision, not assumed: `loadTrack` reads
`normalizeFocus(placement?.focus)` and neither `apps/web/src/lib/track.ts`
nor `packages/db/src/track/generate.ts` references `machineRole` or
`prisma.member` at all, and `normalizeFocus` falls back to all machines when
placement is absent. So a learner with no team can already express focus, and
no fix was needed. Never reintroduce a membership dependency into focus
resolution — that is the one change that would break a solo learner outright.

**041 · 2026-08-23 · The drill deck gets a floor of 3 cards per skill node,
enforced by a reported (not thrown) coverage check in the seed.** Auditing
the banks before starting the content-depth pass turned up a functional hole,
not just thin content: 23 of 85 leaf skill nodes carried zero drill cards,
and because `enqueueLessonCards` resolves cards through the lesson's skill
nodes, **12 of 53 published lessons enqueued nothing at all on completion**.
Finishing a Scripting lesson looked identical to the SRS being broken. A
further 21 lessons enqueued one or two cards — a "review session" too short
to schedule. So the pass started here rather than with question banks. The
deck went 110 → 265 cards, bringing every leaf node to at least 3.
Three decisions worth recording. (a) **The floor is 3, and it is per node,
not per lesson.** Cards are enqueued by skill node, so a per-lesson average
would let a multi-node lesson hide a dead node inside a healthy total —
which is exactly how `windows-server-basics` (three nodes, zero cards) passed
unnoticed. (b) **`findCoverageGaps` returns gaps; it never throws.** It sits
next to `validateCardRefs` in `cards/parse.ts` and is pure, but the two
invariants are different in kind: a bad `skillNodeId` is always a mistake and
must fail the seed, whereas a taxonomy node added ahead of its cards is a
normal authoring state. Blocking `db:seed` on coverage would make the spine
harder to extend, which is the opposite of what the taxonomy rule wants. The
seed prints the gaps after the card-sync line and continues. (c) **Two
orphaned nodes got lessons rather than being left as unreachable cards.**
`networking.devices.dhcp-nat` and `networking.wireless.security` had cards
but no lesson, so nothing could ever enqueue them — a new lesson,
`dhcp-nat-and-wireless` (networking, sortOrder 10), now covers both.
`windows.persistence.wmi` had neither; it gained three cards and a WMI
event-subscription section appended to `persistence-and-malware`, whose
frontmatter now lists the node. Every leaf node in the taxonomy now has both
a lesson and at least three cards, verified by running the real
`parseTaxonomy` / `parseCards` / `parseLessons` over the actual content
files. Note what this does NOT close: the forensics bank (24 questions), the
networking quiz (35), the placement pool (28), and the two checklists (22 and
25 items) are all still thin. Step 1.5 stays open; the drill slice of it is
done.

**042 · 2026-08-23 · Every replayable bank gets enough depth to be replayed;
placement deliberately left alone.** Continuing the content-depth pass (step
1.5) past drill cards. Three banks moved, one was examined and left as it is.
**Forensics 24 → 64**, from 3 questions per archetype to 8. This is the
surface most obviously built for repetition — `/app/forensics` is graded,
replayable, and missed questions enqueue to the SRS — and three questions
means an archetype is exhausted in one sitting, after which replaying it
tests memory of the answers rather than the technique. Every new question is
self-contained: the `given` block carries the evidence and the answer is
derivable from it, with no reference to a machine the learner does not have.
**Networking quiz 35 → 60**, ten per category, same argument at lower
severity. **Checklists 47 → 75 items** (Linux 22 → 36, Windows 25 → 39).
This one was structural rather than thin: nine Linux/Windows leaf nodes had
no item at all and thirty-five had exactly one, which makes the artifact an
index of the taxonomy rather than a round-day procedure. Every Linux and
Windows leaf node now carries at least one item, and the nodes that were
empty — shell-startup persistence, required-service verification,
world-writable files, sysctl, the Apache/PHP web variant, WMI subscriptions,
and the three Windows Server nodes — are exactly the ones a learner would
otherwise meet for the first time in a round.
**Placement was examined and deliberately not changed.** Each domain holds
3 foundations / 2 standard / 2 advanced against `validatePlacementCoverage`'s
3/1/1 floor, and the worst-case ladder path through one attempt consumes at
most 3 foundations, 1 standard, and 1 advanced — so the pool cannot run dry
and `pickQuestion`'s nearest-tier fallback is unreachable by construction,
exactly as its comment claims. The repeat-on-retake property is not a gap
either: `ladder.ts` is deterministic on purpose so "a retake varies only by
the user's own answers," and a learner who has actually improved walks up
into standard and advanced questions they have never seen. Adding questions
here would buy nothing and would dilute a bank that is already correctly
sized for its algorithm.
Verified by running the real `parseTaxonomy`, `parseLessons`, `parseCards`,
`parseForensics`, `parseQuiz`, `parseChecklists`, and `parsePlacement` —
plus each ref- and coverage-validator — over the actual content files. Every
hash and every encoded string in the new forensics questions was recomputed
independently rather than trusted: an unanswerable question is worse than a
missing one. **Step 1 of the locked build order is complete.** Next is step
2, infrastructure.

**043 · 2026-08-24 · Checklist forks become user-ownable; `TeamChecklist`
gains a nullable `userId` and `organizationId` becomes nullable.** Found by
looking at the deployed app rather than the code: `/app/checklists` told the
reader "a coach or captain can customize one for your team." That copy was
accurate, which is the problem. `TeamChecklist` was scoped only by
`organizationId`, so every path — the detail page's fork lookup, the diff
page, the print page, and `requireForkEditor` behind all eight mutations —
began by finding a `Member` row. **A learner with no team therefore could not
create, edit, or diff a checklist at all**, and under the individual-first
scope (040) that learner is the only user the product has. The shipped
fork/diff/print trio, which ROADMAP calls load-bearing for round day, was
unreachable for its entire audience.
This is the same failure mode as 040's focus rule — "a learner with no team
must never be unable to express what they're focusing on" — one model over.
The rule generalizes and is worth stating once: **no core capability may
depend on a `Member` row.**
Decisions inside the fix. (a) **Nullable `userId` beside a now-nullable
`organizationId`, rather than re-scoping the model.** Exactly one is set;
`forkOwnerKind` returns "invalid" when that rule is broken, in both
directions, so a malformed row is inaccessible rather than silently resolved
by picking a column. The migration is purely additive and relaxing —
existing team-owned rows keep their `organizationId`, get `userId` NULL, and
keep working for their coach. Postgres treats NULLs as distinct in a unique
index, so `@@unique([userId, sourceId])` does not collide across the legacy
rows. (b) **New forks are always personal.** Team forks still resolve and
still edit, but nothing creates another one — teams are dormant, and
`createFork` is idempotent across both shapes so a coach with an existing
team fork does not silently get a personal one shadowing it. (c) **Resolution
is personal-first**, in one server-only `loadForkForViewer` shared by all
three pages. It lives in `lib/checklist-access.ts` and not in
`lib/checklist-fork.ts` because the latter is imported by `fork-editor.tsx`,
a client component — putting Prisma there reintroduces the client-bundle
failure of DECISIONS 034/036. (d) **`canEditTeamChecklist` was deleted from
`lib/teams.ts`, not left in place.** It moved to `@roundzero/db` as
`canEditTeamFork`, one branch of `canEditFork`. Two live copies of an
authorization rule is the one kind of duplication worth actively removing.
(e) **Viewing and editing stay separate predicates.** A plain member still
sees a team fork read-only, so `canViewFork` cannot be derived from
`canEditFork` being false.
Copy followed the capability, not the other way round: "Customize for your
team" → "Customize this checklist", "Your team's fork" → owner-dependent via
`forkOwnerLabel`, and the diff view's five team-voiced strings now address
the reader. Fifteen new pure tests cover the ownership matrix; the action
test proves the guard is wired to that decision and that a personal fork
never triggers a membership lookup at all.

**044 · 2026-08-25 · Phase 2 infrastructure spec, and the container security
profile becomes a pure, tested function.** Two things, one of which is a
correction.
*The spec.* `docs/PHASE2_INFRA_SPEC.md` sequences step 2 and — more usefully
— writes down the threat model, which is different in kind from anything in
Phase 1: we are handing an untrusted stranger a root shell on hardware we
own and pay for, and the population being handed it is teenagers being
actively trained to break into Linux boxes. Loopback binding is currently
the entire security model; the broker has no authentication on any route, no
owner recorded against a lab, and no memory, CPU, or PID limit at all.
The one genuinely useful finding from the audit: **the gVisor risk is narrow
and nameable.** Of the 33 checks, 32 are file, content, account, or service
inspection and are indifferent to the runtime. Exactly one is not —
`ufw-active` runs `ufw status`, which is why `docker.ts` grants NET_ADMIN
and NET_RAW, and gVisor's userspace netstack has only partial iptables
support. Worth noting that the three `sysctl-*` checks already grade the
FILE rather than live `sysctl`, a workaround Docker's namespacing forced
earlier and which pays off a second time here; it is the pattern to reach
for if `ufw-active` has to be rewritten.
*The correction.* The spec's first draft made "prove gVisor" step 2.0,
blocking and first, on the grounds that it was the riskiest unknown. That
was wrong and was caught within the hour by trying to run it: gVisor needs a
Linux kernel and `runsc` does not run under Docker Desktop on Windows. The
work had been sequenced by which unknown was riskiest without asking where
that unknown could be *measured*. Corrected order: 2.1 (local,
runtime-independent) → 2.2 (provision) → 2.0 (prove, on the box). The
mistake is recorded in the spec itself, not just here, because the failure
mode generalizes.
*The profile.* `lab-broker/src/sandbox.ts` is new and pure:
`buildHostConfig(limits)` plus `loadSandboxLimits(env)`. It is split out of
`docker.ts` — which is I/O against a live daemon and deliberately untested —
because a resource limit that silently stops being applied is invisible
until the box falls over. Three decisions inside it. (a) **`MemorySwap` is
pinned equal to `Memory`**, never left unset: unset means "twice Memory", so
a container that looks capped at 512M can still take 1G of swap and kill the
host slowly rather than quickly. Asserted as a pair. (b) **The runtime is
config, not a constant.** Hardcoding `"runsc"` would break every local dev
machine, and an empty value omits the field entirely so Docker's default
applies — while a typo'd `RZ_RUNTIME` fails loudly at create time rather
than silently falling back to runc, which would mean believing the box is
gVisor-isolated when it is not. (c) **`Binds: []` and `RestartPolicy: no`
are stated explicitly rather than omitted**, so adding a host mount or a
restart policy is a visible edit rather than an absent-field oversight; a
restarting lab is one the registry has lost track of, since the idle timer
and the owner record live in the broker, not in Docker.
Thirteen tests. Note that `lab-broker` is outside the pnpm workspace, so
root `pnpm test` does not cover it — it has its own CI job, and a local gate
run needs `npm test` inside `lab-broker/` as a separate step.

**045 · 2026-08-25 · `ufw-active` leaves the lab check set: gVisor exposes no
netfilter, so no learner action could ever make it pass.** Spec 2.0, run for
real on WSL2 with `runsc` 20260817.0 and Docker 29.1.3.
*The good half.* State 1 was byte-identical under both runtimes — 0 earned,
29 failing, 3 decoys passing. Every check evaluates correctly under gVisor:
file modes, package state, service enablement, process visibility, SUID
discovery, cron inspection. **The scoring engine is runtime-independent**,
which was the thing most worth knowing and is now known rather than assumed.
*The failure, and why no rewrite saves it.* Under `runsc`, `ufw --force
enable` exits 1 with "Couldn't determine iptables version" and leaves
`ENABLED=no`; under `runc` it exits 0 with `ENABLED=yes` and `Status:
active`. Both backends were tried: `nft` fails at "Failed to initialize nft:
Protocol not supported", and the legacy binary loads but cannot initialize a
single table. So the plan drafted hours earlier — grade `/etc/ufw/ufw.conf`
the way the `sysctl-*` checks grade their file — does **not** work, because
nothing writes `ENABLED=yes` in the first place. The break is in the
learner's action, not the grader, and that distinction is the whole reason
this needed measuring rather than reasoning.
*The decision.* `ufw-active` comes out of the lab: 33 checks → 32, 276 points
→ 266, 30 planted vulns → 29. `prove.sh`'s assertions, the answer key, and
`fix-all.sh`'s call to `fix-ufw.sh` all move with it; the check itself leaves
a tombstone comment in `linux-practice.yaml` explaining why, so nobody
re-adds it in six months. The skill stays fully taught —
`linux-updates-firewall-sysctl`, two Linux checklist items, three drill cards
— it simply is not gradeable in a sandbox with no netfilter. Isolation
outranks a 10-point check and it is not close: gVisor is what stands between
a curious teenager with root and every other lab on the box.
*What the removal bought.* `NET_ADMIN` and `NET_RAW` existed solely for ufw.
Nothing in the remaining 32 checks touches the network stack, so a lab now
runs at **zero added capabilities** — `CapDrop: ALL` with nothing added back,
in both `prove.sh` and `sandbox.ts`'s defaults. Losing the check made the
sandbox strictly tighter, which is the opposite of the usual trade.
*Open.* States 2, 3, and 4 are still unproven under `runsc` — the gVisor run
aborted at state 2 because `fix-all.sh` called `fix-ufw.sh` and `set -eu`
propagated it. The full four-state comparison has to be re-run before 2.0 is
closed. The generated lab README will also need to say plainly that the
sandbox has no netfilter, since a learner running `ufw enable` still meets an
iptables error and silence there reads as a broken lab.

**046 · 2026-08-25 · Lab access is a short-lived HMAC token, and 2.2
(provisioning) moves behind 2.3 (auth).** The broker has no authentication on
any of its five routes or its WebSocket upgrade; loopback binding is the
entire security model. That made "buy the Hetzner box next" the wrong call —
the box would either be exposed with no auth, which hands a root shell to
anyone who finds the port, or sit paid-for and firewalled until the real work
landed. Auth and tenancy are pure logic needing no host, so they come first
and the spend then buys something usable.
*Why HMAC and not a session lookup.* The browser connects to the broker's
WebSocket **directly** — serverless is a poor WS proxy — so the credential
has to ride in something a browser can send and the broker can check with no
callback to `apps/web` and no shared database. A signed token is exactly
that; the only shared state is a secret in both environments. No new
dependency: `node:crypto`.
Four properties, each chosen against a specific failure. (a) **The signature
is verified before the payload is parsed.** Running `JSON.parse` on
unauthenticated attacker-controlled bytes converts a signature check into a
parser attack surface. (b) **`timingSafeEqual`, with an explicit length check
first**, because it throws on length mismatch — and length is fixed for
SHA-256, so that check leaks nothing. (c) **Tokens are scoped to one lab.**
`labId: null` means "may create a lab" and nothing more; a wildcard token
would be a skeleton key, and leaking one must not hand over every lab on the
box. (d) **Verification returns a typed reason, never a bare boolean, and the
reason never reaches the client** — "expired" and "wrong-lab" both confirm a
valid signature, which tells an attacker their secret guess was right. The
broker logs the reason; the client gets "no".
*On the two implementations.* `apps/web` mints and the broker verifies, which
is one format in two places. That is not DECISIONS 043's duplicated-
authorization-rule mistake — signing and checking are genuinely different
operations, and `lab-broker` is outside the pnpm workspace by 027's design so
it cannot import a shared package. The format is instead frozen by
`TEST_VECTOR`: a fixed secret, claims, and expected token string that both
sides assert. A format change fails both test suites rather than failing
silently in production. Worth recording that the vector's signature was
fabricated on the first pass and caught only by computing the real HMAC — a
hand-written constant in a crypto test is worthless and worse than none.
21 token tests; 50 across lab-broker. Still to do in 2.3: wire verification
into the five routes and the upgrade handler, record an owner on every lab in
`LabRegistry`, scope `GET /labs` to that owner, and write the apps/web
minting side against the same vector.

**047 · 2026-08-25 · Token enforcement, owner-scoped labs, and a broker that
refuses to start in an unsafe configuration.** The wiring half of 046: every
route and the WebSocket upgrade now authenticate, and `LabRegistry` records
who owns each lab.
*The startup refusal is the load-bearing part.* `resolveAuthMode(host,
secret)` throws `InsecureConfigError` when the bind is non-loopback and
`RZ_TOKEN_SECRET` is unset. The alternative — a warning and an "auth
disabled" mode — is the exact shape of how services end up publicly exposed
with no authentication: the misconfiguration is invisible until someone
finds the port. Making it impossible to start beats documenting it. Loopback
with no secret stays legal because that is 027's local single-user case
where the bind itself is the boundary, and it is the only configuration in
which `claims` is null and owner scoping is skipped.
*Refusals are indistinguishable.* Routes return a flat `{"error":"Not
found"}` and log the real reason. `getOwned` raises `LabNotFoundError` for a
lab that exists but belongs to someone else — the same error as one that
never existed. A distinct "forbidden" is an oracle for which lab ids are
real, the same reason 046 keeps the verify failure off the wire: "expired"
and "wrong-lab" both confirm a valid signature.
*Two limits, not one.* `maxLabs` is the box's capacity; `maxLabsPerUser`
(default 1) is what any one learner may hold. Without the second, the first
is a shared pool a single user drains — denial of service by accident as
easily as on purpose — and the two produce different messages because the
user's next action differs: wait, versus stop your own lab.
*A hard lifetime.* `sweep()` skips any lab with an attached socket, so the
idle timeout is defeated by leaving a terminal open. Harmless with one user;
a way to hold a slot indefinitely once labs are shared. `maxLifetimeMs`
(default 4h) reaps regardless of sockets or activity.
*Order of operations in the upgrade handler:* authenticate, then resolve
ownership, then `handleUpgrade`. A rejected socket must never have reached a
container.
75 tests in lab-broker. Remaining in 2.3: the `apps/web` minting side
against 046's frozen `TEST_VECTOR`, and `RZ_TOKEN_SECRET` present in both
environments.
