# RoundZero — Onboarding & guided path spec

Turns RoundZero from a **library** into a **path**. Today a total beginner
and a returning competitor land on the same undifferentiated pile: 4 pillars,
~30 lessons, 5 quiz banks, a live lab, a drill. The experienced user copes;
the beginner freezes. Paralysis is the #1 reason people bounce off
self-directed learning tools.

Goal (from the product owner, verbatim intent): *anyone — from someone with
zero cybersecurity knowledge to an experienced competitor — can enter, train,
and genuinely improve.* That requires the platform to know who you are and
tell you what to do next.

This is pure web work (no Docker), ships to production. ~2 sessions.

## What exists vs. what's missing

**Exists (the machinery):** lessons + checks, checklists, SRS drill, quiz
engine (forensics + networking), subnetting trainer, live Linux lab +
debrief, teams. All content maps to a taxonomy spine with per-user progress
already recorded (LessonProgress, QuizProgress, ForensicsProgress,
UserCardState).

**Missing (the guidance layer):**
- No placement — the platform never asks or infers what you know.
- No recommended path — nothing says "start here, then this."
- No "what's next" — every visit begins with a decision the user may not be
  equipped to make.
- No cross-pillar progress view — progress exists per-surface but nowhere
  shows "here's where you are overall."

The original product spec had this as Milestone 4 (placement quiz +
recommended track). The machinery is now all built; this is the layer on top.

---

## PART A — Placement

### Design constraints
- **No lab dependency.** The original spec's placement micro-task required
  the terminal; the lab is local-only and Docker-gated. Placement must work
  for anyone, anywhere, on a Chromebook. Pure questions.
- **Short.** ~12 questions max. Longer and beginners quit before starting.
- **Non-punishing.** A beginner answering "I don't know" to everything must
  feel *placed*, not *failed*. Copy matters enormously here.
- **Skippable.** An experienced user must be able to bypass it and self-select
  a track (or ignore tracks entirely). Never trap someone in onboarding.

### Flow
1. **Self-report first (2 questions, instant):**
   - "How much cybersecurity experience do you have?" → New to it / Some
     (class or self-taught) / Competed before
   - "Which machine will you focus on?" → Windows / Linux / Cisco / Not sure
     yet (multi-select or single; "Not sure" is a valid, common answer and
     must be first-class)
2. **Adaptive knowledge check (~10 questions)** drawn from the existing quiz
   content pools + a small set of new placement-only questions, spanning:
   Foundations concepts (what a service is, what a port is), Linux basics,
   Windows basics, networking basics. Adaptive in the simple, robust sense:
   start at Foundations difficulty; a correct answer in a domain pulls a
   harder question from that domain, an incorrect one drops to easier.
   No IRT modeling — a straightforward difficulty ladder is sufficient and
   testable.
3. **Result:** a per-domain level (Foundations / Standard / Advanced) for
   each of foundations, windows, linux, networking, forensics — mapped to
   the taxonomy's existing `TrackLevel` enum.

### Storage
Add a `Placement` model (or reuse the progress pattern): userId, completedAt,
per-domain level (JSON or columns), and the answers for auditability.
Re-takeable — a user can redo placement later ("I've learned a lot since").

---

## PART B — The recommended track

### What a track is
An **ordered list of next steps** across all pillars, generated from
(placement levels) + (what the user has already completed). Not a rigid
curriculum — a prioritized queue the user can deviate from freely.

### Generation logic (pure, unit-testable — this is the heart)
Given: placement levels per domain, completion state (lessons done, quiz
scores, cards due, lab runs), and the taxonomy (domain → category → skill,
with `level` on skills):

1. **Gate on Foundations.** If foundations level is Foundations (i.e. a
   beginner), the first steps are ALWAYS the foundations lessons — nobody
   should hit "harden SSH" before "what is a service." (This is why Part C's
   content expansion matters.)
2. **Then the focus machine.** From the user's chosen machine (or all, if
   "not sure"), queue that domain's lessons in `sortOrder`, filtered to at-
   or-just-above their placement level.
3. **Interleave practice, don't batch it.** After every ~2 lessons, insert
   the daily drill (if cards are due) and the relevant quiz/trainer. Learning
   science and the product's own philosophy: recall beats re-reading.
4. **Surface the lab when ready.** The Linux lab appears in the track once
   the user has completed the Linux fundamentals lessons — not before (it's
   overwhelming cold) and not never (it's the payoff). Since the lab is
   currently local-only, the track must degrade gracefully: show it as
   available-when-you-can-run-it, with honest copy, rather than a broken link.
5. **Never end.** When a user completes their track, generate the next tier
   (advance a level, or expand to another machine). "You're done" is a dead
   end; "here's what's next" is a platform.

Output: a list of typed steps — `{kind: lesson|drill|quiz|subnetting|
checklist|lab, ref, reason}` — where `reason` is a one-line human
explanation ("You placed at Foundations for Linux — start here").

### Storage
The track can be **derived on read** (pure function of placement +
progress + content) rather than persisted — simpler, always fresh, no
staleness bugs. Persist only placement and the existing progress records.
If performance ever demands it, cache later.

---

## PART C — "What's next" everywhere + progress visibility

### The dashboard (/app — currently a thin gate/redirect)
Make `/app` the home surface it should be:
- **Next up:** the top 1–3 track steps as prominent, single-click actions,
  each with its `reason` line. This is the single most important element on
  the platform for a beginner — it removes the decision.
- **Today:** due drill count, streak, and any in-progress item.
- **Progress across pillars:** a compact view of the four pillars +
  foundations with completion (e.g. "Linux 4/9 lessons · 62% quiz avg ·
  last lab 76/276"). Honest, not gamified into meaninglessness.
- **Skip/self-direct affordance:** an experienced user must be able to browse
  freely — the track is a suggestion, never a cage.

### Everywhere else
- On finishing a lesson/quiz/drill/lab: show the **next track step** inline
  ("Next up: ...") rather than dumping the user back to an index.
- The nav's existing due-count badge pattern extends: the dashboard is the
  default landing after sign-in.

### First-run experience
A signed-in user with no placement sees a clear, warm invitation to take
placement (~3 minutes, "so we can point you at the right starting place"),
with an explicit "skip and browse everything" escape. Never blocking.

---

## PART D — Foundations content expansion (prerequisite for beginners)

**This is what makes the platform genuinely open to a zero-knowledge user.**
Today `foundations` has 3 lessons, all about *competition literacy* (scoring
engine, README, safe-change). There is nothing teaching the actual concepts a
newcomer lacks. The taxonomy already has the nodes, with zero content:
`foundations.core.os-basics`, `.users-perms`, `.services`, `.ports`,
`.passwords`, `.hardening`.

Author ~6 lessons at Foundations level, in the existing MDX format, mapped to
those nodes:
1. **What an operating system actually is** — kernel, processes, files,
   why "the OS" is the thing you're defending.
2. **Users, groups, and permissions** — accounts, admin vs. standard, why
   "who can do what" is the core of security. OS-agnostic concepts, with a
   nod to both Windows and Linux naming.
3. **Services and what they do** — background programs, why they're the main
   attack surface, why "disable what you don't need" is the whole game.
4. **Ports and network connections** — what a port is, listening vs.
   connected, why an open port is a door.
5. **Passwords and password policy** — hashing (conceptually), why length
   beats complexity, what a policy enforces and why.
6. **What hardening means** — putting it together: the mindset, the loop
   (find → fix → verify), and how the competition scores it.

Plus ~10 supporting drill cards on those nodes. These become the mandatory
first steps of a beginner's track (Part B, rule 1).

---

## Build order

- **Session 1 — Part D + Part A** (Foundations content + placement). Content
  first so placement has something to route beginners *into*; placement
  second so it can reference real content. Ships to production.
- **Session 2 — Part B + Part C** (track generation + dashboard/next-up).
  The guidance layer, once the content and placement exist.

## Verification

- Pure track-generation logic gets heavy unit tests: a beginner with no
  progress gets foundations first; an experienced user with foundations
  complete skips them; completing steps advances the queue; the track never
  returns empty for any valid state; the lab step only appears after the
  Linux prerequisites.
- Placement: unit-test the adaptive ladder (correct → harder, incorrect →
  easier) and the level mapping; drive it in a browser as both a "beginner"
  (all wrong) and an "expert" (all right) and confirm sensible, non-punishing
  results.
- Dashboard: verify as a brand-new user (no placement, no progress), a
  mid-progress user, and a completed user (track regenerates, never dead-ends).
- All standard discipline: db:seed idempotent + fails loudly, screen-craft
  checklist, keyboard, reduced-motion, Chromebook width, CI green, Vercel
  production deploy green.

## Copy principle (non-negotiable for this feature)

Every word on the placement and dashboard surfaces is read by someone who may
feel out of their depth. Copy must be plain, warm, and never condescending or
gamified. "You placed at Foundations for Linux — start here" not "Level 1
Novice!" No streaks-as-pressure, no shame for gaps. A beginner should finish
placement feeling *oriented*, not *ranked*.
