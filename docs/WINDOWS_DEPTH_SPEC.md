# RoundZero — Windows depth build spec (lessons + drill expansion)

Closes the Windows knowledge gap. Windows is a full CyberPatriot competition
machine, but RoundZero currently has only a 25-item Windows checklist and a
handful of Windows drill cards — no lessons. This brings Windows to parity
with the Linux and Cisco *knowledge* pillars (lessons + drills + checklist).

## Scope boundary (same as the Windows checklist decision, unchanged)

Per the original product spec, RoundZero does **not** stream/simulate a live
Windows desktop (too heavy for Chromebooks — an explicit non-goal). So the
Windows pillar is **knowledge + drills + reference**, exactly like it is now,
just deepened. Students harden a real Windows box in the actual competition /
on their own machines using Windows' built-in tools; RoundZero teaches them
*what* to do and drills the commands/settings until they're fast.

This is pure web content (no Docker), ships to production. ~1 session.

## Grounding (verified against real CyberPatriot Windows checklists)

The scored Windows categories are well-established and already match the
repo's `windows-core.yaml` checklist:
- Account policy: password length/age/history, complexity, lockout,
  reversible-encryption off.
- Users & groups: unauthorized users/admins, weak/blank passwords,
  password-never-expires, Guest + built-in Administrator.
- Local policy & registry: audit policy, UAC, SMBv1 off, RDP/NLA, the
  "classic" registry findings (autologon, autoplay, password-reveal).
- Services: Telnet, FTP, SNMP, Remote Registry, UPnP, IIS — disable unless
  README-required; protect README-critical services.
- Persistence & malware: Run/RunOnce keys, startup folders, scheduled tasks,
  prohibited tools/files.
- Updates, Defender, firewall, files: Windows Update on, Defender real-time +
  firewall on all 3 profiles, shares (keep only C$/ADMIN$/IPC$), prohibited
  media, hosts-file tampering.

## Taxonomy

Uses the existing `windows.*` nodes (account-policy, users-groups,
policy-registry, services, persistence, defenses-updates, and the server.*
nodes). Everything maps to nodes that already exist — no new taxonomy needed
(add a leaf only if a lesson genuinely needs one, deprecation-safe).

---

## PART A — Windows lessons (packages/content/lessons/windows/*.mdx)

Same MDX + end-of-lesson-check format as the Foundations/Networking lessons.
~8 lessons at Foundations→Standard, each mapped to windows.* nodes,
published:false until a fast factual-accuracy read (like Networking — this is
verifiable factual content, not judgment-dependent, so sign-off is a quick
correctness pass, and it can publish this session).

1. **Windows account and password policy** — length/age/history, complexity,
   lockout, and WHY reversible encryption is a critical finding. Where these
   live (secpol.msc / Local Security Policy) and the `net accounts` command +
   its limits (it can't set complexity — a real trap). Nodes:
   account-policy.*.
2. **Managing users and groups on Windows** — finding unauthorized users and
   admins, the built-in Administrator + Guest accounts, password-never-
   expires, weak/blank passwords. PowerShell: Get-LocalUser,
   Get-LocalGroupMember, Set-LocalUser, Disable-LocalUser. Nodes:
   users-groups.*.
3. **Local policy, UAC, and the registry classics** — audit policy (and why
   it feeds forensics), UAC to max, and the registry findings that recur
   every round (autologon, autoplay, password-reveal). How to safely export a
   key before editing. Nodes: policy-registry.*.
4. **SMB, RDP, and network-facing hardening** — disabling SMBv1 (the WannaCry
   protocol), RDP: disable vs. require-NLA per the README, and why exposed
   remote services are top attack surface. Nodes: policy-registry.smb,
   policy-registry.rdp.
5. **Windows services** — identifying and disabling insecure services
   (Telnet, FTP, SNMP, Remote Registry, UPnP, IIS), the difference between a
   service and a process, and NOT breaking README-required services.
   PowerShell: Get-Service, Stop-Service, Set-Service. Nodes: services.*.
6. **Persistence and malware on Windows** — Run/RunOnce keys, startup
   folders, malicious scheduled tasks, and finding prohibited tools. Where
   persistence hides and how to check each spot. PowerShell:
   Get-ScheduledTask, reg query of the Run keys. Nodes: persistence.*.
7. **Defender, firewall, and updates** — enabling Defender real-time
   protection, the firewall on ALL THREE profiles (the common miss), and
   turning on Windows Update. Why "one profile enabled" isn't enough.
   PowerShell: Get-MpComputerStatus, Set-NetFirewallProfile,
   Set-MpPreference. Nodes: defenses-updates.*.
8. **Shares, files, and the hosts file** — auditing SMB shares (keep only the
   default admin shares), finding prohibited media, and detecting a poisoned
   hosts file. PowerShell: Get-SmbShare, Remove-SmbShare. Nodes:
   defenses-updates.shares-ntfs, defenses-updates.prohibited.

(Optional 9th — a Windows Server basics lesson mapping to the server.* nodes,
if it fits: role minimization, GPO password enforcement, AD/DNS
fundamentals — the later-round Server image content.)

Each ends with a check (existing lesson-check infra). Commands render in
mono (PowerShell/cmd). They slot into the /app/lessons index under a
"Windows" domain group alongside Foundations, Networking, etc. — confirm the
index groups by domain and extend.

---

## PART B — Windows drill card expansion (append to packages/content/cards/)

The repo already has ~some Windows cards; expand to ~30 total Windows cards
(concept + command), mapped to windows.* nodes, in the existing SRS format.
Prioritize COMMAND cards (PowerShell/cmd recalled cold is exactly what SRS is
for) plus key concept cards. Examples:

COMMAND:
- "List local users with their enabled state" → `Get-LocalUser | Select
  Name,Enabled`
- "List members of the Administrators group" → `Get-LocalGroupMember -Group
  Administrators`
- "Set password policy: min length 14, max age 90, history 5" →
  `net accounts /minpwlen:14 /maxpwage:90 /uniquepw:5`
- "Enable the firewall on all three profiles" → `Set-NetFirewallProfile
  -Profile Domain,Private,Public -Enabled True`
- "Check Defender real-time protection status" → `Get-MpComputerStatus |
  Select RealTimeProtectionEnabled`
- "List enabled scheduled tasks" → `Get-ScheduledTask | Where {$_.State -ne
  'Disabled'}`
- "Disable SMBv1" → `Disable-WindowsOptionalFeature -Online -FeatureName
  SMB1Protocol -NoRestart`
- "Query the Run key for persistence" → `reg query
  "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"`
- "List SMB shares" → `Get-SmbShare`
- "Disable the Guest account" → `Disable-LocalUser -Name Guest`
- ... (audit policy via auditpol, UAC registry value, RDP NLA registry value,
  hosts file path, etc.)

CONCEPT:
- "Can `net accounts` set password complexity?" → "No — complexity needs
  secpol.msc or secedit export/import. net accounts does length/age/history/
  lockout only."
- "Which 3 firewall profiles must be enabled?" → "Domain, Private, Public —
  enabling one and missing the others is a common scored miss."
- "Which default SMB shares should you KEEP?" → "C$, ADMIN$, IPC$ — removing
  these breaks Windows; remove only NON-default shares."
- "Why is reversible password encryption a critical finding?" → "It stores
  passwords in a reversible (plaintext-equivalent) form — always disable it."

These flow into the existing daily drill automatically (cards on windows.*
nodes).

---

## Verification (the session)

- db:seed idempotent + fails loudly on bad refs (lessons, cards).
- Drive in a real browser: complete a Windows lesson + its check, confirm it
  appears in the lessons index under a Windows group, confirm new Windows
  drill cards flow into the daily drill.
- Factual-accuracy read of the lessons (PowerShell syntax correct, the
  net-accounts-can't-do-complexity trap stated right, firewall/Defender
  commands accurate) — then publish.
- Missed items enqueue to SRS.
- CI green; Vercel production deploy live (pure web content — works on prod).

## Result

Closes the last knowledge-pillar gap: all four competition machines
(Windows, Linux, Cisco, plus Forensics) now have lessons + drills, and
Windows/Linux additionally have full checklists. The remaining gaps after
this are the Docker-dependent lab scenarios (forensics box, 2nd Linux box —
deferred to when home) and coach tools.
