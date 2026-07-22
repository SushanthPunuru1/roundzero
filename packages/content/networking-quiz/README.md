# Networking quiz bank — authoring format

Standalone, repeatable networking knowledge questions covering the finite
CyberPatriot-tested Cisco content (the real round is a 10-question networking
quiz — this is the practice bank behind it). Synced to the `QuizQuestion`
table by the seed script; graded as normalized strings server-side, same
engine as the forensics question bank (`packages/content/forensics/README.md`)
— `quizId: networking` is what tells them apart in the shared `QuizQuestion`/
`QuizProgress` tables. One file per category under `networking-quiz/*.yaml`.

## File contract

```yaml
version: 1
questions:
  - id: networking-quiz.q.port-rdp          # globally unique, dotted lowercase
    category: ports                         # subnetting | ports | protocols |
                                             # ios-commands | security | vlan-acl
    skillNodeId: networking.fundamentals.ports  # must resolve to a taxonomy leaf skill
    prompt: "Question text, self-contained — no box required."
    given: |                                # OPTIONAL — many networking questions
      $ optional terminal output or sample  # are pure recall with nothing to show
      data the student needs, shown verbatim
      in a mono block under the prompt.
    answer: "the canonical answer"
    accepts: ["the canonical answer", "an accepted alternate phrasing"]
    case_sensitive: false                   # true only when the real answer key cares
    strip_trailing_slash: false             # true only for path-shaped answers
    technique: "optional: the command/method that finds this"  # OPTIONAL
    why: "one line on why this matters"
```

The one difference from the forensics contract: `given` and `technique` are
**optional** here. Forensics questions always have live evidence to show and
a technique that finds it; a lot of networking recall ("what command saves
the config?") has neither — it's a straight knowledge check.

## Authoring rules

Same discipline as forensics: self-contained, graded as exact strings (never
multiple choice), one atomic question per entry, `technique` (when present)
is the real command a student would run. See
`packages/content/forensics/README.md` for the full rationale — it applies
here unchanged.
