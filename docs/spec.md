# CyberRange — Complete Product Specification
**A free, open-source, browser-based training platform for CyberPatriot teams**

One-line pitch: TryHackMe-class infrastructure, purpose-built for the one competition thousands of high-school teams train for with no real tooling. Independent and unofficial — not affiliated with the Air & Space Forces Association or CyberPatriot.

---

## 0. Design Principles

Every decision in this document traces back to one of these five rules:

1. **Chromebook-first.** A huge share of teams practice on locked-down school Chromebooks that cannot run VMs at all. If a feature doesn't work in a browser tab, it isn't core.
2. **The debrief is the product.** Labs exist to create the moment where a student sees exactly what they missed and why. Every scored item links back to its lesson.
3. **Coaches are the distribution channel.** Most CyberPatriot coaches are non-technical teachers. Anything a coach touches must assume zero security background.
4. **Free forever, open source.** This is simultaneously the adoption strategy, the trust strategy, and the story.
5. **Integrity by design.** Nothing on the platform may help a team cheat in a live round. Protecting that reputation with AFA and coaches is what makes school-by-school adoption possible.

**Non-goals (equally binding):** not a general pentest trainer, no offensive/attack labs, no streamed Windows desktops, no paid tier, no native mobile apps, never an answer bank for live competition images.

---

## 1. Users, Roles, and Team Structure

Mirror the real competition's structure exactly so coaches recognize it instantly.

- **Student** — completes lessons, labs, drills; belongs to 0–1 teams.
- **Team Captain** — a student with extra powers: assigns machine roles (Windows / Linux / Cisco), schedules team practices, views the team coverage matrix.
- **Coach** — adult account; creates teams, manages rosters, assigns work, runs scrimmages, sees progress data only (no student PII beyond display name). One coach can run multiple teams (common at big schools).
- **Organization** — optional school-level grouping when one school fields several teams; aggregate dashboards.
- **Mentor/Alumni** — read-only role for graduated members or technical mentors; can view debriefs and leave comments, cannot see live scrimmage answers.
- **Platform Admin** — content management, moderation, abuse response.

Teams: 2–6 members plus coach, tagged by division (**Open / All Service / Middle School**) — matching real CyberPatriot team composition. Join via coach-generated codes; roster import via CSV.

---

## 2. Onboarding and Placement

- **Student placement (10 minutes):** ~12 adaptive questions plus one micro-task in an embedded terminal ("find the file containing X"). Output: a recommended starting track (Foundations / Standard / Advanced) per domain — a student can be Advanced-Linux and Foundations-Cisco simultaneously.
- **Coach setup wizard:** create team → invite roster → pick practice cadence → platform auto-generates a season plan backdated from the official round calendar.
- **First-session experience:** every new student ships into a 15-minute guided lab that ends with their first scored fix. Activation target: first lab within 24 hours of signup.

---

## 3. Curriculum (the full content map)

All lessons are short (5–10 min), written in "why-first" style, and end with an interactive check. Content lives as MDX in the public Git repo — community members contribute via pull request.

### 3.1 Foundations Track (zero-experience onboarding)
What an OS is; users, groups, and permissions conceptually; what a service/daemon is; what a port is; passwords and policy; what "hardening" means; how the CyberPatriot scoring engine behaves (points, penalties, critical services); reading a README; safe-change discipline (back up before you modify).

### 3.2 Windows Track (Desktop + Server)
Account policies (length/age/history/complexity/lockout) · Local Security Policy and audit policy · UAC · user and group auditing (unauthorized users, unauthorized admins, weak/blank passwords, "password never expires" flags) · service management (disable Telnet/FTP/SNMP/RemoteRegistry as appropriate; never kill README-required services) · persistence hunting (Run/RunOnce keys, startup folders, scheduled tasks, malicious services, WMI persistence for advanced) · prohibited files and tools · Windows Update and application updates · Defender, SmartScreen, and Firewall profiles · RDP hardening (NLA, allowed users) · SMB hardening · registry classics (legal notice caption/text, autoplay, password reveal) · shares and NTFS permissions · Event Viewer basics · Server-specific: role minimization, Group Policy password enforcement, DNS/AD fundamentals (later-round content).

### 3.3 Linux Track (Ubuntu / Mint / Debian)
/etc/passwd and /etc/shadow auditing (duplicate UID 0, unauthorized accounts) · sudoers and NOPASSWD audit · PAM (pam_pwquality minlen and credits, pam_pwhistory, faillock) · password aging with chage · SSH hardening (PermitRootLogin, PasswordAuthentication per README, MaxAuthTries, X11Forwarding) · systemd service auditing (disable unauthorized daemons, protect critical ones) · cron and persistence (system and user crontabs, /etc/cron.*, rc.local, malicious systemd units, .bashrc payloads, rogue authorized_keys) · malware and prohibited content (netcat listeners, miners, media files, cracking tools unless README-authorized) · file permissions (shadow 600/640, sudoers 440, sticky /tmp, unauthorized SUID/SGID) · apt updates and unattended-upgrades · UFW · sysctl hardening (ip_forward, syncookies, redirects, rp_filter) · web-server-present variants (Apache/PHP minimal hardening when README requires the service stay up).

### 3.4 Forensics Track
The CyberPatriot forensics-question archetypes: file hunting by name/content/timestamp · hashing (md5sum, certutil) · login history (last, Event Viewer 4624) · decoding (base64 and friends) · basic steganography · browser artifacts · archive handling · listening-port identification (ss/netstat) · "answer format discipline" (exact-match answers, no trailing spaces).

### 3.5 Cisco / Networking Track
Quiz bank aligned to the CyberPatriot networking quiz: OSI, TCP/UDP and the classic port list, subnetting/CIDR (with an infinite-drill generator), VLANs and trunking, ACL logic, wireless security, device hardening (enable secret, SSH vs telnet, banners, console/vty lines). Packet Tracer scenario library with guided walkthroughs (link out to NetAcad's free Packet Tracer — never redistribute it). **Later phase:** an in-browser simulated IOS CLI for the ~20 commands the competition actually exercises.

### 3.6 Scripting / Automation Track (advanced)
Bash: from user-audit one-liners to a full audit script. PowerShell: Get-LocalUser / Get-Service / registry queries into an audit script. Emphasis on read-only auditing first, and change-logging.

### 3.7 Meta-skills Track
README parsing drills (the trap patterns: authorized users hidden in prose, "insecure-looking" services that must stay up) · point strategy (forensics early, never gamble with critical services) · six-hour time management · team role splits · the change log habit.

**Spaced repetition:** every track feeds a per-user SRS deck (concept cards + command cards). Daily drill = 5 minutes of due cards + one micro-task.

---

## 4. Interactive Checklist System

- Canonical, maintained Windows and Linux checklists where every line has: the action, the *why*, the exact commands/paths for each OS version, and a link to its lesson.
- **Fork/version/diff:** teams fork the canonical lists, customize, and diff against upstream when the canonical list updates. Effectively "GitHub for hardening checklists" — this replaces today's scattered-repo ecosystem.
- Per-season versioning (rules and image patterns shift yearly; content is tagged by season).
- **Print/PDF export** formatted for round day. CyberPatriot permits teams to use their own prepared reference materials during rounds, so a beautiful printable export is a genuinely load-bearing feature.
- Checklist items are checkable during a live lab session, and the platform cross-references: "you checked this item but the scored vuln in this category is still open."

---

## 5. Live Lab Environment (the centerpiece)

### 5.1 What a session looks like
Student clicks **Launch** → within ~20 seconds gets a full Ubuntu desktop (or terminal-only in low-bandwidth mode) streaming in the browser tab → a score report page updates in near-real-time exactly like the real CyberPatriot scoring system: points gained, issues found "X of Y", penalties in red → session ends with an automatic **debrief page**.

### 5.2 Vulnerability injection and randomization
- Vulns are defined as YAML **templates** (inspired by the open-source aeacus format): category, difficulty, point value, injection script, and one or more detection checks (file_contains / service_state / user_in_group / perm_equals / package_state / command_output).
- Each lab instantiation is **seeded**: usernames drawn from name pools, ports and paths varied, and a difficulty-budgeted subset of vulns selected (e.g., Standard = ~14 vulns, 100 points, spread across categories with weights). Labs are therefore infinitely replayable and answer-sharing between students is useless.
- A generated **README** accompanies every image — scenario, authorized users and admins, critical services — because README parsing is itself a tested skill.
- Solvability is guaranteed by construction (every injected vuln has a verified detection check).
- Seeds are stored, so a coach can re-issue the identical image, and scrimmages can run everyone on the same seed for fairness.

### 5.3 Scoring engine
- An agent runs inside the image as a root service, polls its check list every 30–60 s, and pushes deltas over WebSocket to the score UI.
- **Penalty checks** mirror the real engine: stopping a README-critical service, deleting an authorized user → red penalty lines.
- Killing the agent ends the session — which deliberately teaches the real-competition rule (never touch the scoring service).
- Forensics answers are typed into files on the desktop, exactly like the real thing.

### 5.4 Lab tiers
| Tier | Hints | Timer | Score report | Purpose |
|---|---|---|---|---|
| Guided | Unlimited, overlay walkthrough | None | Full | First exposure per topic |
| Standard | Hint ladder (costs points) | Soft | Full | The core loop |
| Timed Sim | None | 60–90 min hard | CCS-style only | Competition conditioning |
| Hardcore | None | Hard | Points only, no category breakdown | Advanced/State-level prep |

### 5.5 Session lifecycle and quotas
Warm pool of pre-booted containers for <20 s cold start · idle warning at 20 min, teardown at 30 · 4-hour max session · reconnect within TTL resumes your exact machine · one concurrent lab per student (two for captains running team prep) · daily minute quotas to control cost, generous during season.

### 5.6 Debrief page (the pedagogical core)
Full list of every injected vuln — found and missed — each with the fix, the why, and a link to its lesson; missed items are auto-queued into the student's SRS deck. Optional terminal session recording (asciinema-style) for self-review; coaches can open any team member's debrief.

---

## 6. The Windows Problem (solved legally)

Windows desktops cannot be streamed from the cloud without licensing that a free platform can't carry. The competition is half Windows. The bridge:

- Ship an **open-source local scoring agent** plus vulnerability-injection scripts. A student builds a local VM from Microsoft's free evaluation ISOs (documented step-by-step, VirtualBox and Hyper-V paths), runs the injector, practices, and the agent scores locally **and syncs results to the platform** — so Windows practice still appears in streaks, mastery, coach dashboards, and leaderboards.
- All Windows *knowledge* content (Track 3.2, checklists, SRS) remains fully in-browser, so Chromebook-only students still cover the Windows half academically and drill hands-on skills on shared machines at practice.
- Never host, mirror, or accept uploads of official CyberPatriot images, READMEs, or answer keys. Hard rule, enforced in the AUP and the upload pipeline.

---

## 7. Practice Modes

1. **Guided labs** — tutorial overlays, unlimited hints.
2. **Standard scored labs** — the default loop; hint ladder costs points.
3. **Timed competition sim** — single image, hard timer, real-style score report, no hints.
4. **Full round simulation** — 2–3 images (Ubuntu live + local-agent Windows) + forensics + optional Cisco quiz in a 4–6 hour window; the team splits machines exactly like a real round; one shared score report per image.
5. **Daily drills** — 5-minute SRS + one micro-task; streak-tracked.
6. **Scrimmages** — coach-scheduled; every team/member gets the identical seed; live leaderboard; results archived to team history.
7. **Season ladder** — one ranked image per month, brackets mirroring the real **Platinum/Gold/Silver** tier structure so the ladder feels native to the competition; auto-locks during official round weekends.

---

## 8. Coach Dashboard and Playbooks

- **Roster and assignment:** assign tracks, checklists, or specific labs to individuals or the whole team, with due dates.
- **Coverage heatmap:** members × skill domains, mastery-colored. One glance answers "who is our Linux person and who's faking it."
- **Scrimmage scheduler:** pick a date, a difficulty, and a seed policy; the platform emails/Discord-pings the roster and runs the leaderboard.
- **Readiness report:** auto-generated PDF seven days before each official round — coverage matrix, weakest three domains, recommended final-week plan, scrimmage history. This PDF is also the artifact coaches forward to administrators, i.e., organic marketing.
- **Zero-background playbooks:** "Run your first practice in 45 minutes," "Your team's first scrimmage," "Week-before-Round-1 plan" — literal scripts a non-technical teacher can follow.
- Weekly email digest; .ics calendar feed of the official season + team events.

---

## 9. Team Features

Machine-role assignment (Windows / Linux / Cisco leads) · team coverage matrix with gap warnings ("nobody above 40 mastery in PAM") · private team wiki for notes and round retrospectives (retro template provided) · team checklist forks · scrimmage and sim history with score trendlines.

---

## 10. Progression, Gamification, Leaderboards

XP awarded only for **verified fixes and completed drills** (not logins) · mastery per domain (0–100, slow decay to encourage revisiting) · badges tied to real skills (Service Guardian: zero penalties in a timed sim; Shadow Auditor: 100% on a permissions category; First Blood: first fix inside 5 minutes) · streaks · individual and team leaderboards, opt-out available, school-only view by default for minors · season titles matching ladder brackets. Tasteful, not casino-like.

---

## 11. Community Layer

- **Library:** browse and fork public checklists and community lesson notes; contributor reputation; moderation queue.
- **Post-round debriefs:** discussion threads per official round that **unlock only after the round window closes** and are auto-locked during live windows — the integrity mechanic that makes the platform recommendable by coaches and defensible to AFA.
- Discord bridge: webhooks for scrimmage announcements; role sync later.
- Content-as-code: lessons and vuln templates in the public repo mean community PRs are the contribution path.

---

## 12. AI Tutor (guardrailed)

- Grounded exclusively on platform lessons and the current lab's *category* metadata.
- Three-step hint ladder: concept → where to look → how to verify. Never emits the final command/fix in any scored mode.
- Disabled entirely in Timed Sim, Hardcore, ladder, and scrimmage modes.
- **Season kill-switch:** during official CyberPatriot round weekends, the tutor refuses anything that resembles live-image content, date-aware and automatic.
- Rate-limited; transcripts sampled for abuse review.

---

## 13. Platform Security and Abuse Prevention

You are handing strangers root inside your infrastructure; the threat model assumes every session is hostile. This section is also the project's best engineering story.

- **Isolation:** gVisor (runsc) syscall-filtered containers — or Firecracker microVMs at scale — with dropped capabilities, seccomp, no-new-privileges, read-only base image + tmpfs overlay.
- **Egress lockdown:** default-deny network namespace per session. The only reachable endpoints: the platform API and an internal apt-mirror/caching proxy — so "install updates" vulns still work while the sandbox can't scan, DDoS, or mine.
- **Resource caps:** cgroup CPU/memory/pids/disk limits per session; automated teardown on anomalies (pegged CPU, egress attempts).
- **Plane separation:** lab hosts are physically/logically separate from the app and database plane; one-way, token-scoped API between them.
- Short-lived signed tokens for VNC/terminal websockets · rate limiting and WAF at the edge · full audit log of session lifecycle events · quotas per user and per IP.
- **security.txt + responsible disclosure page**, and periodically publish self-pentest write-ups of the platform — credibility, content, and a genuinely unusual line for a student project.

---

## 14. Accounts, Privacy, Compliance

- Auth: magic link + Google; school-friendly (no passwords to forget).
- **Minors:** self-signup at 13+; the Middle School division means under-13 users exist — they join only via **coach-managed accounts** with school/parental consent attestation (COPPA-conscious).
- Data minimization: display handle, optional first name, grade band (no DOB), school optional. Coaches see progress data only. Self-serve export and delete.
- No ads, no data sale, privacy-respecting analytics only (e.g., Plausible). This is a trust feature coaches actively check.
- **Trademark/IP hygiene:** product name avoids "CyberPatriot"; nominative use only ("training for the CyberPatriot® competition"); no AFA logos; prominent unofficial disclaimer; DMCA/abuse contact.
- Licensing: AGPL-3.0 for the platform (prevents closed commercial forks), MIT for the local agent, CC BY-SA for content.
- AUP: no live-round content, no uploading official images, no attacking the platform outside the disclosure program. Enforcement: account ban + coach notification.

---

## 15. Accessibility and Device Support

Chromebook-first rendering targets · **low-bandwidth mode**: terminal-only labs (xterm.js) usable under ~100 kbps, full desktop stream (noVNC/Kasm-style) when bandwidth allows · WCAG 2.1 AA, fully keyboard-navigable, dark mode · responsive read-only mobile (lessons and SRS on phones; labs on desktop/Chromebook) · command palette (⌘K) global search.

---

## 16. Architecture and Stack (concrete)

- **Frontend:** Next.js + TypeScript + Tailwind, deployed on Vercel.
- **API:** TypeScript (single language end-to-end), on Fly.io or a Hetzner node.
- **Data:** Postgres (Neon/Supabase) + Prisma; Redis (Upstash) for queues, sessions, rate limits.
- **Lab plane:** dedicated Hetzner boxes running Docker with the gVisor runtime; a small custom **orchestrator** service (warm pool management, seeding, lifecycle, teardown); streaming via noVNC/ttyd over authenticated WebSockets.
- **Realtime:** WebSockets for score feeds and scrimmage leaderboards.
- **Storage:** Cloudflare R2 for assets and session recordings.
- **Observability:** Sentry, Prometheus + Grafana on lab nodes, public status page, structured audit logs.
- **Delivery:** GitHub Actions CI; Terraform + Ansible for lab nodes; signed container images.
- **Cost envelope:** two mid-size Hetzner boxes (~$50–100/mo total) sustain roughly 40–80 concurrent desktop sessions or hundreds of terminal-only sessions; burst capacity rented for scrimmage nights. The whole platform runs on club-budget money.

---

## 17. Analytics and the Skill Model

Per-domain mastery computed from lab item outcomes + SRS performance, with item-level difficulty calibration (items that everyone misses get reviewed, not just students) · "next best action" recommendation on every student home screen · coach heatmap and readiness reports derive from the same model · platform-level dashboards: activation, weekly active teams, season retention.

---

## 18. Operations

Season SLO: **99.5% uptime Nov 1 – Feb 15**, with deploy freezes the 48 h before each official round weekend · status page + incident history · in-app feedback widget on every page · public changelog · content packs versioned by season.

---

## 19. Build Order (dependency-driven, with gates)

Phases exist because each layer must be validated before the next is built on top of it — not because of time pressure.

| Phase | Scope | Gate to proceed |
|---|---|---|
| 1 | Auth, teams, lessons, interactive checklists, SRS | Own club completes Win+Linux tracks; ≥80% weekly return over 3 weeks |
| 2 | Linux live labs: orchestrator, 5 template packs, scoring agent, debriefs | 25 external users complete a lab; cold start <20 s; zero isolation incidents |
| 3 | Coach layer: dashboard, assignments, heatmap, scrimmages, readiness PDF, playbooks | 5 external coaches run a scrimmage unassisted |
| 4 | Windows bridge: local agent + injectors + sync | A stranger sets it up end-to-end from docs alone on a fresh VM |
| 5 | Cisco module: quiz bank, subnetting trainer, PT library; simulated IOS CLI later | Quiz bank covers the full published topic list |
| 6 | Community: library forking, post-round debriefs, season ladder | First externally-contributed checklist merged |
| 7 | Scale and polish: warm pools, burst orchestration, session replay, AI tutor GA | Survives a 100-concurrent scrimmage night |

---

## 20. Success Metrics

Activation: first lab within 24 h of signup · weekly active **teams** (the unit that matters, not users) · Round 1 → State retention · median Standard-lab score, attempt 1 vs attempt 5 (learning is happening) · scrimmages per coach per month · % of teams with ≥60 mastery in ≥6 domains before Round 1 · coach NPS after each round.

---

## Appendix A — Vulnerability Template Taxonomy (seed database)

The initial injectable-vuln library, organized exactly as the content team should build it. Every template gets: difficulty tag, point weight, injection script, detection check(s), debrief explanation, lesson link.

**Windows — Account Policy:** min length · max/min age · history · complexity · lockout threshold/duration/reset window.
**Windows — Users/Groups:** unauthorized user · unauthorized admin · weak/blank password · password-never-expires flag · guest enabled · admin not renamed · disabled-user-who-should-be-active (README trap).
**Windows — Policy/Registry:** audit policy gaps · UAC lowered · autoplay on · "do not display last user" off · legal notice caption/text missing · SMBv1 enabled · RDP without NLA · password-reveal button enabled.
**Windows — Services:** Telnet/FTP/SNMP/RemoteRegistry running · README-critical service (penalty if stopped).
**Windows — Persistence/Malware:** Run/RunOnce keys · startup-folder payloads · malicious scheduled task · malicious service · netcat listener · keylogger artifact · WMI persistence (advanced).
**Windows — Files/Updates/Firewall:** prohibited media/tools · vulnerable outdated app · Windows Update disabled · Defender off · firewall profile off · open share with bad permissions · hosts-file tampering.
**Linux — Accounts:** duplicate UID 0 · unauthorized user/sudoer · NOPASSWD sudoers line · weak passwords · no aging via chage · root SSH-able.
**Linux — PAM/SSH:** missing pam_pwquality settings · no pw history · no faillock · PermitRootLogin yes · PasswordAuthentication contrary to README · high MaxAuthTries.
**Linux — Services/Persistence:** anonymous vsftpd · telnetd installed · rogue systemd unit · malicious cron entries (system/user/cron.d) · rc.local payload · .bashrc payload · rogue authorized_keys · README-critical service (penalty).
**Linux — Files/Perms:** shadow world-readable · sudoers wrong mode · unauthorized SUID/SGID binary · world-writable system dir · sticky bit missing on /tmp · prohibited media/tools.
**Linux — Updates/Network:** stale apt · unattended-upgrades off · bad sources entry · UFW disabled · ip_forward on · syncookies off · redirects accepted.
**Forensics generators:** hidden-file hunt · hash-this-file · decode-this-string · who-logged-in-when · listening-port identification · browser-artifact question.

## Appendix B — Season Calendar Integration

Content, ladder, lockouts, and readiness reports all key off the official published CyberPatriot calendar for the current season (registration → Round 1 ~Nov → Round 2 ~Dec → State ~Jan → Semifinals → Finals). The platform stores the calendar as data, updated each season, so integrity lockouts and coach plans regenerate automatically every year.
