# Forensics question bank — authoring format

Standalone, repeatable CyberPatriot-style forensics questions. Synced to the
`ForensicsQuestion` table by the seed script; graded as normalized strings
server-side (never multiple choice — real CP forensics answers are exact
strings). One file per archetype under `forensics/*.yaml`.

## File contract

```yaml
version: 1
questions:
  - id: forensics.q.base64-harden        # globally unique, dotted lowercase
    archetype: decoding                  # decoding | file-hunting | hashing |
                                          # login-history | answer-format |
                                          # stego | ports | accounts
    skillNodeId: forensics.core.decoding # must resolve to a taxonomy leaf skill
    prompt: "Question text, self-contained — no box required."
    given: |
      $ terminal output or sample data the student needs to answer,
      shown verbatim in a mono block under the prompt.
    answer: "the canonical answer"
    accepts: ["the canonical answer", "an accepted alternate phrasing"]
    case_sensitive: false                # true only when the real answer key cares
    strip_trailing_slash: false          # true only for path answers where a
                                          # trailing slash is explicitly tolerated
    technique: "the exact command that finds this"
    why: "one line on why this matters / why CP scores it this way"
```

## Authoring rules

- **Self-contained.** `given` carries whatever sample data (terminal output,
  a log excerpt, a passwd line, a hex dump) the student needs — there's no
  live box in Part A, so every question must be answerable from the prompt
  alone.
- **`answer`/`accepts` are graded as strings**, not read back to the client
  until after a submission is graded. Normalize expectations: trim always
  applies; `case_sensitive`/`strip_trailing_slash` are per-question because
  real CyberPatriot answer keys are genuinely inconsistent about both.
- **The `answer-format` archetype teaches the discipline directly** — its
  questions are deliberately designed so a plausible near-miss (wrong case,
  a stray trailing slash, doubled internal spacing) triggers the "close, but
  check your formatting" feedback path instead of a flat "incorrect."
- One question = one atomic lookup. If a question needs "and", split it.
- `technique` is the real command a student would run on a live box — even
  though Part A never launches one, the reflex is the point.
