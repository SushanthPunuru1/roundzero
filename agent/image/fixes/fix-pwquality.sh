#!/bin/bash
# Remediates: pwquality-minlen
set -eu
cat > /etc/security/pwquality.conf <<'EOF'
minlen = 14
dcredit = -1
ucredit = -1
ocredit = -1
lcredit = -1
EOF
