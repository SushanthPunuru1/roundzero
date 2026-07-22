# RoundZero — Cisco / Networking build spec

Closes the networking pillar — a full third of CyberPatriot that's currently
empty. Grounded in how the CyberPatriot **Cisco Networking Challenge**
actually works (verified against competition descriptions):

- The Cisco Challenge = **Packet Tracer network-build** (most points) + a
  **10-question open-internet networking quiz**.
- Cisco is widely considered the **most learnable specialty** — all tested
  content is fixed and finite (specific NetAcad modules), unlike the
  open-ended OS hunt. That makes a strong knowledge trainer unusually
  high-leverage: mastering the finite content ≈ mastering the specialty.

## Honest scope boundary (read first)

**We do NOT rebuild Packet Tracer.** It's Cisco's proprietary desktop
network simulator; recreating it is out of scope and off-mission
(Chromebook-first, free, browser-based). RoundZero's Cisco pillar owns the
two things we CAN own and that genuinely move a competitor's score:

1. **The quiz knowledge** — subnetting, protocols, ports, concepts — directly
   what the 10-question quiz tests.
2. **The command/config knowledge** — the IOS commands and configuration
   steps a student must KNOW to perform the Packet Tracer build (device
   hardening, VLANs, ACLs, interface/IP config, routing basics). We teach
   everything up to the simulator; the student practices the hands-on build
   in Packet Tracer itself (which we link/point to).

This is deliberately the same shape as the Windows pillar: deep
knowledge + drills + reference, without trying to stream/simulate the actual
environment. It covers most of what's *learnable outside the sim*.

Three deliverables, all pure web content (no Docker), all ship to
production like forensics Part A:
- **Part A — Networking lessons** (MDX, like the Foundations lessons).
- **Part B — Subnetting trainer** (an interactive, generative practice tool —
  the one piece of custom interactivity, because subnetting is a *skill*
  drilled by volume, not memorized).
- **Part C — Networking quiz bank + IOS command drills** (question bank in
  the forensics-question style + drill cards in the existing SRS style).

Build as ~2 sessions: Part A+C together (content + quiz, reusing existing
patterns), then Part B (the custom subnetting trainer). Or all three if
scoped tight.

---

## Taxonomy

Uses existing `networking.*` nodes (fundamentals.osi, fundamentals.tcp-udp,
fundamentals.subnetting, devices.hardening, devices.vlans, devices.acls).
Add leaves as needed (deprecation-safe, never rename):
- `networking.fundamentals.ports` (the classic port list — distinct from
  tcp-udp concept)
- `networking.devices.ios-basics` (modes, `enable`, `conf t`, `show`
  commands, saving config)
- `networking.devices.routing` (static routes, default route, RIP/OSPF
  basics — the finite subset CP tests)
- `networking.devices.dhcp-nat` (DHCP pool, NAT basics — appear in Packet
  Tracer builds)
- `networking.wireless.security` (WPA2/3, SSID — appears in the curriculum)

---

## PART A — Networking lessons (packages/content/lessons/networking/*.mdx)

Same MDX + end-of-lesson-check format as the Foundations lessons. Author
~8 lessons at Foundations→Standard, each mapped to networking nodes and
`published: false` until editorial sign-off (though for a knowledge domain
this is factual, so sign-off is a fast accuracy read):

1. **The OSI model, usefully** — the 7 layers, what actually lives at each,
   and why a competitor cares (which layer a problem is at). Node:
   fundamentals.osi.
2. **TCP vs UDP and the ports you must know** — the protocol difference +ther
   canonical port list (20/21, 22, 23, 25, 53, 67/68, 80, 110, 143, 443,
   445, 3389, etc.). Nodes: fundamentals.tcp-udp, fundamentals.ports.
3. **IP addressing and subnetting, from scratch** — binary, CIDR, network vs
   host bits, subnet mask, network/broadcast/usable range. The conceptual
   companion to the Part B trainer. Node: fundamentals.subnetting.
4. **VLSM and subnetting a network** — variable-length subnetting for a given
   host-count requirement (the Packet Tracer archetype). Node:
   fundamentals.subnetting.
5. **Cisco IOS basics** — user vs privileged vs config mode, `enable`,
   `configure terminal`, `show running-config`, `copy run start`, hostname,
   interface config, assigning an IP. Node: devices.ios-basics.
6. **Device hardening on IOS** — `enable secret`, `service
   password-encryption`, SSH (not telnet), console/vty line passwords,
   banners, disabling unused services. The security half — maps directly to
   the OS-hardening mindset the student already has. Node: devices.hardening.
7. **VLANs and trunking** — what a VLAN is, access vs trunk ports, basic
   config. Node: devices.vlans.
8. **ACLs, conceptually** — standard vs extended, permit/deny logic, order
   matters, implicit deny. Node: devices.acls.

(Optional 9th: static routing + default route basics — node
devices.routing — if it fits.)

Each ends with a check (existing lesson-check infra). Commands render in
mono. These slot into the existing /app/lessons index alongside Foundations —
so the lessons index should group by domain (Foundations, Networking, and
later others), which it may already do; confirm and extend.

---

## PART B — Subnetting trainer (the one custom interactive tool)

Subnetting is a *skill* — you get good by doing dozens, not by reading one
explanation. This is a GENERATIVE practice tool: it produces random
subnetting problems, checks answers, and gives instant feedback with the
worked solution. This is the single highest-value custom piece in the Cisco
pillar (and genuinely fun to build).

### /app/subnetting

- **Problem generator** (client-side, deterministic-testable): produce
  random problems of several types:
  1. Given an IP + CIDR (e.g. 192.168.10.0/26): find network address,
     broadcast address, first/last usable host, number of usable hosts,
     subnet mask.
  2. Given an IP + mask in dotted decimal: same outputs.
  3. VLSM: given a base network and a required host count, find the smallest
     subnet that fits (the CIDR).
  4. "Which subnet is this host in?" — given an IP and mask, find its network.
- **Answer checking**: the student fills fields (network, broadcast, usable
  range, host count, mask). Exact-match with clear per-field right/wrong.
- **Instant worked solution** on submit: show the binary breakdown / the
  math, not just the answer — this is where the *learning* is. Reveal the
  step-by-step (borrow bits, block size, etc.).
- **Difficulty / mode**: quick round (5 problems), or endless practice with
  a running accuracy stat. A timer option (competition is timed).
- Keyboard-first; mono for all addresses; meets screen-craft checklist.
- **Pure logic must be unit-tested hard**: the subnet math (network,
  broadcast, usable count, VLSM fit) is deterministic and testable — this is
  exactly the kind of pure logic that gets heavy Vitest coverage. Generate
  problems from a seed so tests are reproducible.

This tool needs NO backend state beyond optionally recording best accuracy
(reuse the progress pattern). It's client-side generative + a pure math
module.

---

## PART C — Networking quiz bank + IOS command drills

### C1 — Networking quiz bank (packages/content/networking-quiz/*.yaml)

Same content model + grading as the forensics question bank (string/choice
answers, exact-match, reuse that infra). ~30 questions covering the finite
CP-tested content, mapped to networking nodes:
- Subnetting quick-answers (how many hosts in /27? what's the mask for /20?).
- Port identification (what port does X use? what runs on 3389?).
- Protocol concepts (TCP vs UDP, which is connectionless? what's OSPF vs
  RIP? what layer is a switch?).
- IOS command recall (what command saves the config? what enters config
  mode? how do you set an enable secret?).
- Security (why enable secret over enable password? telnet vs SSH?).
- VLAN/ACL concepts (what's the implicit rule at the end of an ACL?).

These mirror the real 10-question networking quiz. Surface: extend
/app/forensics's quiz engine into a general "quiz" surface, OR add a
/app/networking quiz section reusing the same components — the forensics
quiz infra is general enough to host these (a "question set" is a question
set). Prefer reuse: generalize the forensics quiz surface into a shared
quiz component if it isn't already, so networking, forensics, and future
quizzes all share it. Wire missed questions to SRS.

### C2 — IOS command drill cards (append to packages/content/cards/*.yaml)

~20 COMMAND-type drill cards for IOS, in the existing SRS format, mapped to
networking.devices.* nodes:
- "Enter privileged EXEC mode" → `enable`
- "Enter global config mode" → `configure terminal`
- "Save running config to startup" → `copy running-config startup-config`
- "Set an encrypted enable password" → `enable secret <pw>`
- "Encrypt all plaintext passwords" → `service password-encryption`
- "Assign an IP to an interface" → `ip address <ip> <mask>` (in int config)
- "Create/enter VLAN 10" → `vlan 10`
- "Set a port as access VLAN 10" → `switchport mode access` +
  `switchport access vlan 10`
- ... (routing, ACL syntax, show commands)

These flow into the existing daily drill automatically (they're just cards
on networking nodes).

---

## Build order & sessions

- **Session 1 — Part A + Part C** (content + quiz + drill cards): lessons,
  the quiz bank (reusing/generalizing the forensics quiz surface), and the
  IOS drill cards. All existing patterns, mostly authoring + wiring. Ships
  to production.
- **Session 2 — Part B** (subnetting trainer): the one custom interactive
  tool, with a heavily unit-tested pure subnet-math module and a generative
  problem engine. Ships to production.

## Verification (each session)

- db:seed idempotent + fails loudly on bad refs (lessons, quiz, cards).
- Drive each surface in a real browser: take a networking quiz (correct/
  incorrect/format feedback), complete a lesson check, and — for Session 2 —
  solve subnetting problems (correct and incorrect, confirm the worked
  solution and per-field checking).
- Subnet math: exhaustive unit tests (known-answer problems across CIDR
  ranges, VLSM fits, edge cases like /31, /32, /30).
- Missed items enqueue to SRS.
- CI green; Vercel production deploy live (pure web content — works on prod).

## Note on scope honesty in the UI

The Cisco pillar's copy should be honest that the hands-on Packet Tracer
build happens in Packet Tracer itself (link to Cisco's free download), and
RoundZero trains the knowledge + commands + subnetting that make that build
fast and correct. Don't imply RoundZero simulates Packet Tracer. This mirrors
the "independent/unofficial" honesty already in the app.
