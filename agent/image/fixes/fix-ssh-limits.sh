#!/bin/bash
# Remediates: ssh-maxauthtries, ssh-x11forwarding — via the drop-in that
# actually wins (60-devops-limits.conf), proving the check evaluates sshd's
# MERGED config, same as fix-ssh-dropin.sh does for ssh-permitrootlogin.
set -eu
sed -i \
  -e 's/^MaxAuthTries.*/MaxAuthTries 4/' \
  -e 's/^X11Forwarding.*/X11Forwarding no/' \
  /etc/ssh/sshd_config.d/60-devops-limits.conf
