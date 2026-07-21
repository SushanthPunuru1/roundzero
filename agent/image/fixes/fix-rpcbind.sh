#!/bin/bash
# Remediates: rpcbind-disabled
#
# Deliberately NOT `--now`: nothing boots in this container (no real systemd
# PID 1 / D-Bus), so `--now`'s attempt to stop the live unit fails with
# "Failed to connect to bus: Host is down". `disable` alone (offline unit-
# symlink mode, same mechanism the service check itself uses) is sufficient
# and deterministic — see the wiring caveat in VULN_EXPANSION_SPEC.md.
set -eu
systemctl disable rpcbind.service
