#!/bin/bash
# Applies every remediation — the "fully hardened" harness state.
set -eu
DIR="$(dirname "$0")"
"$DIR/fix-uid0.sh"
"$DIR/fix-unauthorized-sudo.sh"
"$DIR/fix-pwquality.sh"
"$DIR/fix-faillock.sh"
"$DIR/fix-ssh-dropin.sh"
"$DIR/fix-cron.sh"
"$DIR/fix-insecure-service.sh"
"$DIR/fix-shadow-mode.sh"
"$DIR/fix-suid.sh"
"$DIR/fix-ufw.sh"
# --- vuln expansion (10 -> 30): see ../../VULN_EXPANSION_SPEC.md ------------
# fix-pwquality.sh above already remediates pwquality-credits too (it writes
# all four credit lines alongside minlen) — no separate script needed.
"$DIR/fix-svc-backup.sh"
"$DIR/fix-sudo-nopasswd.sh"
"$DIR/fix-empty-password.sh"
"$DIR/fix-chage-maxdays.sh"
"$DIR/fix-pwhistory.sh"
"$DIR/fix-ssh-limits.sh"
"$DIR/fix-cron-user.sh"
"$DIR/fix-bashrc.sh"
"$DIR/fix-authorized-keys.sh"
"$DIR/fix-vsftpd.sh"
"$DIR/fix-rpcbind.sh"
"$DIR/fix-passwd-writable.sh"
"$DIR/fix-sudoers-mode.sh"
"$DIR/fix-world-writable.sh"
"$DIR/fix-second-suid.sh"
"$DIR/fix-sysctl.sh"
