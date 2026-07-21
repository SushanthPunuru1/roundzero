# RoundZero — Forensics build spec (question bank + gradable scenario box)

Closes the forensics pillar. Two deliverables, both grounded in how real
CyberPatriot forensics questions actually work (verified against real
practice-image answer keys):

- **Part A — Forensics question bank:** standalone, repeatable question sets
  in the existing content-as-code + quiz style, teaching the answer
  patterns as fast reps.
- **Part B — Forensics scenario box:** a new gradable lab image
  (`forensics-practice`) built on the existing agent engine, where planted
  evidence produces "Forensics Question N" prompts the student answers by
  investigating a real container — plus the signature CyberPatriot
  discipline: **read the questions before you fix anything, because fixing
  destroys evidence.**

This is content for ~1-2 Claude Code sessions. Part A is pure web-app
content (no Docker). Part B extends the agent/lab engine.

## Research grounding (what real CP forensics questions ARE)

Verified archetypes from real CyberPatriot practice-image answer keys:
1. **Decode a base64 message** left on the Desktop → answer is the decoded
   text.
2. **Find prohibited media** → answer is the absolute path to the directory
   containing `.mp3`/`.mp4` files (`locate '*.mp3'` / `find / -name '*.mp3'`).
3. **Find a user's UID** → answer is the number (`id <user>` / `getent
   passwd <user>`).
4. **Identify a byte sequence (BOM)** in a file → answer like `EF BB BF`
   (`xxd <file>`).
5. **Find prohibited software** → answer is the package name (`apt list
   --installed | grep <x>`).
6. **Login/last history** → who logged in / from where (`last`, auth logs).
7. **Listening ports / suspicious connections** → port or process (`ss
   -tulpn`).
8. **Hashing** → the hash of a file (`md5sum`/`sha256sum`).

Two universal rules the content must teach because CP scores on them:
- **Read ALL forensics questions before modifying the box** — fixing a vuln
  (deleting the user, removing the file) can erase the answer.
- **Answer-format discipline** — exact match, no trailing spaces, exact
  case/path. Real questions are auto-graded on exact strings.

---

## PART A — Forensics question bank (web-app content)

New content type: a **forensics question** with a scenario blurb, a prompt,
an expected answer (or accepted-answers list), a hint, the technique/command
that finds it, and a "why it matters" line. Mirrors the lesson-check and
drill-card content-as-code pattern; graded like the lesson checks (exact/
normalized string match, since CP answers are strings, not multiple choice).

### Content model (packages/content/forensics/*.yaml)

```yaml
- id: forensics.q.base64-message
  archetype: decoding
  skillNodeId: forensics.core.decoding
  prompt: "A file 'message.txt' on the Desktop contains an encoded string.
           Decode it. What is the plaintext message?"
  given: "aGFyZGVuIGV2ZXJ5dGhpbmc="      # the string the student decodes
  answer: "harden everything"
  accepts: ["harden everything"]          # normalized: trim + case-insensitive unless case matters
  case_sensitive: false
  technique: "echo '<string>' | base64 -d"
  why: "Base64 hides messages in plain sight; decoding is a core forensics reflex."
```

### Question set to author (~24 questions, ~3 per archetype)

Cover all 8 archetypes above, at Foundations→Standard difficulty, each
mapped to a `forensics.core.*` taxonomy node:
- **decoding** (`forensics.core.decoding`): base64 decode ×2, ROT13/hex ×1.
- **file hunting** (`forensics.core.file-hunting`): find prohibited mp3 path,
  find a file by content (`grep -r`), find by recent mtime.
- **hashing** (`forensics.core.hashing`): md5sum of a given file, verify a
  hash matches.
- **login history** (`forensics.core.login-history`): who last logged in,
  from what IP (given a sample `last`/auth-log snippet in the prompt).
- **decoding/answer-format** (`forensics.core.answer-format`): a question
  specifically drilling exact-format answers (path with trailing slash or
  not, exact case) — teach the discipline explicitly.
- **stego** (`forensics.core.stego`): BOM byte sequence via `xxd`; a strings-
  in-image question.
- **ports** (`forensics.core.ports`): given `ss -tulpn` output, name the
  suspicious listening port / process.
- **UID / accounts** (map to `forensics.core.file-hunting` or a new
  `forensics.core.accounts` node if cleaner): find a user's UID from a
  passwd snippet.

For the pure-knowledge ones (login history, ports), the "given" data is
embedded in the prompt so the question is self-contained (no box needed) —
this is what makes Part A standalone and Chromebook-instant.

### Grading (reuse lesson-check infra)

- Normalize: trim whitespace; lowercase unless `case_sensitive: true`;
  optionally strip a trailing slash for path answers (configurable per
  question, because CP is strict — teach both).
- Accept an `accepts[]` list for legitimate alternate phrasings.
- On submit: correct/incorrect + reveal the technique and why. Wrong-answer
  feedback should specifically call out format if the answer was "close"
  (right content, wrong format) — that's the CP lesson.

### Surface (/app/forensics)

- Index: the forensics question sets, grouped by archetype, with the user's
  best score (reuse the lessons/drill progress pattern).
- A set runs like a short quiz: prompt → type answer → submit → feedback →
  next. Keyboard-first. Meets the screen-craft checklist.
- Wire missed questions into the SRS drill (reuse enqueueSkillNodeCards on
  the forensics skill nodes) — same loop as lessons/labs.

---

## PART B — Forensics scenario box (agent/lab engine)

A second gradable image, `forensics-practice`, that makes the archetypes
REAL: planted evidence in a live container, "Forensics Question N" files on
a Desktop dir, answered by investigating with actual commands. This exercises
the exact CP experience the question bank can't: *you have to find it on a
real box, and the read-before-you-fix discipline matters.*

### The engine addition needed: an "answer" check type

The existing 7 check types grade system STATE. Forensics questions grade a
STUDENT-SUPPLIED ANSWER STRING against expected — a genuinely new need. Add
ONE new check type:

```
type: forensics_answer
  question_id: fq1
  prompt: "..."            # shown to the student
  answer: "1007"           # expected
  accepts: ["1007"]
  case_sensitive: false
  strip_trailing_slash: true|false
  points: N
```

Unlike state checks, this needs the student's input. Mechanism (keep it
simple and local):
- The lab UI renders the box's forensics questions (from the image's
  question manifest) as input fields alongside the terminal.
- The student investigates in the terminal, types answers into the fields,
  and "Score" sends {question_id: answer} to the broker, which the agent (or
  the broker directly) grades against the manifest with the same
  normalization rules as Part A.
- This is additive: state checks still run exactly as before. A forensics
  scenario's score = state checks (planted vulns) + forensics_answer checks
  (questions), so a forensics box teaches BOTH "answer the question" AND
  "then fix the vuln" — exactly like real CP.

### The image: forensics-practice

Base on the existing image tooling. Plant ~6 forensics questions AND their
underlying vulns, so the read-before-fix lesson is real:

1. **Q1 base64 message** — `/root/Desktop/ForensicsQuestion1.txt` says
   "decode message.txt". `/root/Desktop/message.txt` contains a base64
   string. Answer = decoded text. (Pure evidence, no vuln to fix.)
2. **Q2 prohibited mp3 path** — plant `.mp3` files under a user's Music dir.
   Answer = the absolute directory path. The vuln (prohibited files) is ALSO
   scorable via a state check — so answer Q2, THEN remove the files.
3. **Q3 unauthorized user's UID** — plant an unauthorized user with a
   specific UID. Q3 answer = that UID. The vuln = remove the user. **This is
   the trap: if the student deletes the user before answering Q3, the
   evidence is gone.** The content/README must teach reading first.
4. **Q4 BOM byte sequence** — a file with a UTF-8 BOM; answer = `EF BB BF`
   via `xxd`.
5. **Q5 suspicious listening port** — a process listening on an odd port;
   answer = the port number (found via `ss -tulpn`). Vuln = kill/disable it.
6. **Q6 md5 hash** — answer = md5sum of a named file.

Plus a README on the Desktop, exactly like a real image: lists the
forensics questions' existence and the golden rule ("read all questions
before modifying"). And 1 decoy (an authorized media file the README
permits — don't flag it) to keep the authorization lesson alive.

### Prove it (extend the harness pattern)

A `forensics-practice` proof that asserts:
- Fresh box: forensics_answer checks all "unanswered/incorrect" (0), planted
  state vulns fail, score = 0.
- All-correct + hardened: every question answered correctly AND every vuln
  fixed → full score.
- The trap demo: show that the CORRECT flow (answer Q3 → then delete the
  user) scores full, while deleting the user first makes Q3 unanswerable —
  documenting WHY read-before-fix matters. (This can be a documented demo
  rather than a hard assert if simulating student input is awkward; at
  minimum unit-test the forensics_answer grading normalization.)
- Unit tests for the new check type's normalization (trim, case, trailing
  slash, accepts[]).

---

## Taxonomy note

All forensics content maps to existing `forensics.core.*` nodes
(file-hunting, hashing, login-history, decoding, stego, ports,
answer-format). If a UID/accounts forensics node is cleaner than reusing
file-hunting, add `forensics.core.accounts` to taxonomy.yaml (deprecation-
safe, never rename existing IDs) and reseed.

## Build order

1. **Session 1 — Part A** (pure web content, no Docker): the forensics
   question content model, ~24 questions, /app/forensics surface, grading
   reusing lesson-check infra, SRS wiring, nav entry. Ship and verify this
   first — it's immediately useful and Chromebook-instant.
2. **Session 2 — Part B** (agent/lab engine): the `forensics_answer` check
   type, the `forensics-practice` image with ~6 questions + vulns + README,
   the lab UI answer-fields alongside the terminal, broker grading, and the
   proof/tests. This makes the lab plane multi-scenario (it now serves TWO
   images — see the note below).

## Multi-scenario note (relevant to both this and the coming Linux #2 box)

Part B introduces a SECOND lab image, so the lab surface needs to let the
student CHOOSE which scenario to launch (linux-practice vs.
forensics-practice). Build a minimal lab picker in Session 2 (or as a tiny
precursor): the broker's POST /labs takes an image id; the /app/lab page
lists available scenarios with a short description and a Launch button each.
This same picker will host the web-server Linux box and future scenarios —
so build it generically (scenarios as a small registry), not hard-coded to
two.
