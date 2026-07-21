#!/bin/bash
# Remediates: pwhistory-remember — via the canonical 24.04 location.
set -eu
cat > /etc/security/pwhistory.conf <<'EOF'
remember = 5
EOF
