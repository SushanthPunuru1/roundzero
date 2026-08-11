# Lessons — authoring format

Lessons are `.mdx` files under `lessons/<domain>/`. The lesson-pipeline
milestone builds the sync + renderer against this contract.

## Frontmatter contract

```yaml
slug: scoring-engine          # globally unique, kebab-case; becomes Lesson.slug
title: How the scoring engine behaves
why: "Knowing how the engine checks your work stops you fighting it in the middle of a round."
domainId: foundations         # top-level taxonomy node id
level: foundations            # foundations | standard | advanced
minutes: 7
sortOrder: 1
published: false              # stays false until a human editor reviews
skills:                       # taxonomy node ids this lesson teaches
  - foundations.competition.scoring-engine
check:                        # end-of-lesson check, rendered by the pipeline
  - q: "Question text?"
    options: ["A", "B", "C", "D"]
    answer: 2                 # 0-based index into options
    why: "One-line explanation shown after answering."
```

## Writing `why`

`why` is the one-line "why this, why now" the track generator shows verbatim
on the dashboard "Next up" card and on every inline next-step strip. It is
required, and it must be specific to **this** lesson.

- Write the sentence only this lesson could carry. If it would read equally
  well above any other lesson, it isn't done. (The dashboard once showed a
  per-bucket constant here, and a beginner's top three cards were three
  copies of one sentence — see DECISIONS 038.)
- One sentence, roughly under 100 characters so it doesn't wrap on a
  Chromebook. Sentence case, plain verbs, no filler.
- Warm and forward-looking. Never a rank, never a score, never "you should".
- Say what it unlocks or what it prevents, not what the lesson contains —
  the title already says that.

## Body rules

- No H1 — the title renders from frontmatter. Start with a short intro
  paragraph, then `##` sections.
- Sentence case headings. Plain verbs. Commands and paths in backticks.
- Write to a brand-new club member: concrete numbers, real examples,
  no textbook voice.
- `published: false` is the review gate: an editor with competition
  experience reads the lesson, fixes anything that doesn't match reality,
  then flips the flag. Nothing ships unreviewed.
