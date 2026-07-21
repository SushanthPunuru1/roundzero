#!/bin/bash
# PARTIAL remediation for sysctl-ip-forward ONLY — deliberately leaves
# sysctl-rp-filter and sysctl-accept-redirects still failing. Used only by
# scripts/prove.sh's half-fixed state to prove writing one line in a
# multi-check file credits only that one check (no partial credit bleed).
# Not part of fix-all.sh.
set -eu
cat > /etc/sysctl.d/99-roundzero.conf <<'EOF'
net.ipv4.ip_forward = 0
EOF
