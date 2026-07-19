#!/bin/bash
# Remediates: ssh-permitrootlogin — via the file that actually wins.
#
# The main /etc/ssh/sshd_config is deliberately left at "PermitRootLogin
# yes" here: this script exists to prove that the check evaluates sshd's
# MERGED config (sshd -T), so fixing the winning file — the drop-in — is
# enough on its own, regardless of the main file's value. See PART 3 state 4
# in agent/README.md.
set -eu
sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config.d/50-cloud-init.conf
