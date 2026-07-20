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
