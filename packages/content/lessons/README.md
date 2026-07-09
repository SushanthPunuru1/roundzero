# Lessons — authoring format

Lessons are `.mdx` files under `lessons/<domain>/`. The lesson-pipeline
milestone builds the sync + renderer against this contract.

## Frontmatter contract

```yaml
slug: scoring-engine          # globally unique, kebab-case; becomes Lesson.slug
title: How the scoring engine behaves
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

## Body rules

- No H1 — the title renders from frontmatter. Start with a short intro
  paragraph, then `##` sections.
- Sentence case headings. Plain verbs. Commands and paths in backticks.
- Write to a brand-new club member: concrete numbers, real examples,
  no textbook voice.
- `published: false` is the review gate: an editor with competition
  experience reads the lesson, fixes anything that doesn't match reality,
  then flips the flag. Nothing ships unreviewed.
