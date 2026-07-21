#!/bin/bash
# Remediates: sysctl-ip-forward, sysctl-rp-filter, sysctl-accept-redirects —
# writes the full hardening file. See fix-sysctl-partial.sh for the
# partial-credit demo (writes only the ip_forward line).
set -eu
cat > /etc/sysctl.d/99-roundzero.conf <<'EOF'
net.ipv4.ip_forward = 0
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
EOF
