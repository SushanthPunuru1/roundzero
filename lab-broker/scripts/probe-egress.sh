#!/usr/bin/env bash
# Verifies the egress-lockdown design against a real Docker daemon.
#
# The broker puts each lab on its own `Internal: true` network (DECISIONS
# 050). That is an assumption about Docker's behaviour and about the practice
# image's needs, and neither is worth trusting unverified — 045 is the
# cautionary tale, where a perfectly reasonable prediction about `ufw` under
# gVisor turned out to be wrong in a way only running it revealed.
#
# Three questions, and the third is the one that could change the design:
#   1. Does an internal network actually block DNS?
#   2. Does it actually block outbound TCP?
#   3. Does `apt-get purge` still work without a route off the host?
#      fix-insecure-service.sh and fix-vsftpd.sh both call it, so if purge
#      needs the network, egress lockdown breaks two of the 32 checks.
#
# Usage: bash lab-broker/scripts/probe-egress.sh
# Requires: Docker, and the rz-practice image built (agent/scripts/prove.sh).
set -uo pipefail

IMAGE="${RZ_IMAGE:-rz-practice:latest}"
NET="rz-egress-probe-$$"
FAILED=0

cleanup() { docker network rm "$NET" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> Creating internal network $NET"
docker network create --internal "$NET" >/dev/null

run_probe() {
  local label="$1" network_args="$2"
  echo
  echo "=================================================================="
  echo "$label"
  echo "=================================================================="
  # -i is load-bearing: without it docker does not attach stdin, so `bash -s`
  # reads nothing, exits 0, and the probe silently reports nothing at all.
  # shellcheck disable=SC2086
  local output
  output=$(docker run --rm -i $network_args "$IMAGE" bash -s <<'PROBE'

set -u
echo "--- DNS resolution (expect failure when locked down)"
if timeout 5 getent hosts deb.debian.org >/dev/null 2>&1; then
  echo "    DNS: RESOLVED  (egress NOT blocked)"
else
  echo "    DNS: blocked or unresolvable"
fi

echo "--- Outbound TCP to 1.1.1.1:443 (expect failure when locked down)"
if timeout 5 bash -c 'exec 3<>/dev/tcp/1.1.1.1/443' 2>/dev/null; then
  echo "    TCP: CONNECTED  (egress NOT blocked)"
else
  echo "    TCP: blocked"
fi

echo "--- apt-get purge (must succeed either way, or two checks break)"
if apt-get purge -y vsftpd >/tmp/purge.log 2>&1; then
  echo "    PURGE: ok"
else
  echo "    PURGE: FAILED (exit $?) — egress lockdown would break fix-vsftpd.sh"
  tail -5 /tmp/purge.log | sed 's/^/      /'
fi
PROBE
  )
  local status=$?
  if [ -z "$output" ]; then
    echo "    !! NO OUTPUT — the probe container produced nothing (exit $status)."
    echo "       That is a broken probe, not a passing test. Do not read it as success."
    FAILED=1
    return
  fi
  echo "$output"
}

run_probe "BASELINE — default bridge (egress allowed)" ""
run_probe "LOCKED DOWN — internal network (egress denied)" "--network $NET"

echo
echo "=================================================================="
echo "Read it as: baseline should resolve/connect; locked down should not."
echo "PURGE must say ok in BOTH — if it fails only when locked down, the"
echo "design has to change, not the expectation."
echo "=================================================================="

if [ "$FAILED" -ne 0 ]; then
  echo
  echo "PROBE FAILED TO RUN — see the !! line above. Nothing was verified."
  exit 1
fi
