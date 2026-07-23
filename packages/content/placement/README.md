# Placement question bank — authoring format

The multiple-choice bank behind `/app/placement` (`docs/ONBOARDING_PATH_SPEC.md`
Part A). Read server-side, transiently, at each step of the placement flow —
**there is no `PlacementQuestion` DB table**; the seed script only validates
this content against the taxonomy and logs a count (see
`packages/db/src/placement/ladder.ts`'s header comment for why). One file per
domain under `placement/*.yaml`.

## File contract

```yaml
version: 1
domain: linux                        # foundations | linux | windows | networking — one per file
questions:
  - id: placement.linux.sudo-basics  # globally unique, dotted lowercase
    tier: foundations                # foundations | standard | advanced
    skillNodeId: linux.accounts.sudoers  # must resolve to a taxonomy leaf skill
    prompt: "What does sudo let a Linux user do?"
    options:
      - "Run a command with elevated (root) privileges"
      - "Permanently delete a file"
      - "Restart the machine automatically"
    answer: 0                        # 0-based index into options
    why: "sudo grants temporary elevated privileges for one command."
```

## Authoring rules

- **Multiple choice, not typed exact-string.** Unlike the forensics/networking
  quiz banks, this is a placement instrument for someone who may be a total
  beginner — typing an exact answer under uncertainty is its own source of
  anxiety this flow is explicitly trying to avoid. Options only, always
  answered by selecting.
- **Never author an "I'm not sure yet" option.** The UI appends it to every
  question itself (`NOT_SURE` in `packages/db/src/placement/ladder.ts`) — it's
  always the last choice, always nudges the adaptive ladder easier, and is
  never framed to the user as a wrong answer. Keeping it out of the YAML means
  it can never collide with an authored `answer` index.
- **`tier` drives the adaptive ladder**, not necessarily the difficulty of the
  referenced skill node itself (a taxonomy node's own `level` tag describes
  the *subject*; a placement question's `tier` describes how hard *this
  specific question* about it is — the foundations domain in particular has no
  standard/advanced-tagged skill nodes of its own, but still needs
  standard/advanced-tier *questions* so a strong competitor can place
  Foundations at Advanced rather than being artificially capped).
- **Coverage floor per domain: at least 3 foundations-tier, 1 standard-tier,
  1 advanced-tier question** — the ladder's worst-case single run needs that
  many (`validatePlacementCoverage`, enforced at seed time). This file's
  actual content authors slightly above the floor (2 standard + 2 advanced)
  so a retake doesn't always show the identical question.
- **`answer`/`why` never ship to the client** until a question has been
  graded — the placement server action re-reads this YAML, same discipline as
  lesson checks (`packages/content/lessons/README.md`) and the forensics/quiz
  banks.
- One question = one atomic concept. Plain language, no assumed prior
  knowledge for foundations-tier questions in particular — this bank is a
  beginner's very first contact with the platform.
