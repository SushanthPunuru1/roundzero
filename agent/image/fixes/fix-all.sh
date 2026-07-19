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
