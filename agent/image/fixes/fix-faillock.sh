#!/bin/bash
# Remediates: faillock-deny
set -eu
cat > /etc/security/faillock.conf <<'EOF'
deny = 5
fail_interval = 900
unlock_time = 900
EOF
