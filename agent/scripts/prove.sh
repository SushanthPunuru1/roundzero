#!/usr/bin/env bash
# Builds the agent + the linux-practice image, then runs all four grading
# states from a fresh container each, printing and self-asserting each
# score. This is the primary proof for agent/PART 3 (see agent/README.md).
#
# Usage: bash agent/scripts/prove.sh
# Requires: Docker only. No local Go install is assumed — the agent is
# built inside a golang container.
set -euo pipefail

# On Windows/git-bash, MSYS auto-converts bare unix-looking arguments (like
# a container-side "/src") into bogus host paths (e.g. "C:/Program
# Files/Git/src"). Disabling that globally and instead supplying explicit
# Windows-style host paths (`pwd -W`) for every host-side argument sidesteps
# the whole class of path-mangling issues. No-op on real Linux/macOS.
export MSYS_NO_PATHCONV=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -W 2>/dev/null || pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd -W 2>/dev/null || pwd)"
IMAGE_TAG="rz-practice:latest"
PLATFORM="linux/amd64"
WORKDIR="$(mktemp -d)"

cleanup() {
  for c in fresh hardened half altfix trap-demo; do
    docker rm -f "rz-practice-$c" >/dev/null 2>&1 || true
  done
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

fail=0
assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" != "$actual" ]; then
    echo "  FAIL: $label — expected $expected, got $actual"
    fail=1
  else
    echo "  ok:   $label == $actual"
  fi
}

# --- Step 1: build the static agent binary inside a golang container -------
echo "==> Building rzagent ($PLATFORM, via golang:1.23 container)"
docker run --rm --platform "$PLATFORM" \
  -v "$AGENT_DIR":/src -w /src \
  -e CGO_ENABLED=0 -e GOOS=linux -e GOARCH=amd64 \
  golang:1.23 \
  go build -o /src/rzagent ./cmd/rzagent

# --- Step 2: build the vulnerable practice image ----------------------------
echo "==> Building $IMAGE_TAG"
docker build --platform "$PLATFORM" -t "$IMAGE_TAG" "$AGENT_DIR/image"

# start_container NAME
start_container() {
  local name="$1"
  docker rm -f "rz-practice-$name" >/dev/null 2>&1 || true
  # NET_ADMIN/NET_RAW: ufw (the ufw-active check) manipulates iptables/nftables
  # rules and network sysctls, which need these capabilities even in a
  # plain (non-systemd, non-privileged) container. The real Phase 2
  # orchestrator will need to grant the same to any lab container a
  # student is expected to run `ufw enable` inside.
  docker run -d --platform "$PLATFORM" --cap-add=NET_ADMIN --cap-add=NET_RAW \
    --name "rz-practice-$name" "$IMAGE_TAG" >/dev/null
  docker cp "$AGENT_DIR/rzagent" "rz-practice-$name:/usr/local/bin/rzagent" >/dev/null
  docker cp "$AGENT_DIR/checks/linux-practice.yaml" "rz-practice-$name:/opt/checks.yaml" >/dev/null
  docker exec "rz-practice-$name" chmod +x /usr/local/bin/rzagent
}

# score NAME -> writes JSON report to $WORKDIR/NAME.json, prints text report
score() {
  local name="$1"
  docker exec "rz-practice-$name" rzagent --checks /opt/checks.yaml --json > "$WORKDIR/$name.json"
  docker exec "rz-practice-$name" rzagent --checks /opt/checks.yaml
}

total_earned() { grep -oE '"totalEarned": [0-9]+' "$1" | grep -oE '[0-9]+'; }
total_possible() { grep -oE '"totalPossible": [0-9]+' "$1" | grep -oE '[0-9]+'; }
pass_count() { grep -c '"pass": true' "$1"; }
fail_count() { grep -c '"pass": false' "$1"; }
check_pass() { grep -A6 "\"id\": \"$2\"" "$1" | grep -oE '"pass": (true|false)' | grep -oE '(true|false)'; }

echo
echo "==================================================================="
echo "STATE 1 — fresh vulnerable box (no fixes applied)"
echo "==================================================================="
start_container fresh
score fresh
assert_eq "state1 totalEarned" 0 "$(total_earned "$WORKDIR/fresh.json")"
assert_eq "state1 totalPossible" 276 "$(total_possible "$WORKDIR/fresh.json")"
assert_eq "state1 failing checks (the 30 planted vulns)" 30 "$(fail_count "$WORKDIR/fresh.json")"
assert_eq "state1 passing checks (the 3 decoys)" 3 "$(pass_count "$WORKDIR/fresh.json")"

echo
echo "==================================================================="
echo "STATE 2 — fully hardened box (fix-all.sh)"
echo "==================================================================="
start_container hardened
docker exec "rz-practice-hardened" /opt/fixes/fix-all.sh
score hardened
assert_eq "state2 totalEarned" 276 "$(total_earned "$WORKDIR/hardened.json")"
assert_eq "state2 passing checks (all 33)" 33 "$(pass_count "$WORKDIR/hardened.json")"
assert_eq "state2 failing checks" 0 "$(fail_count "$WORKDIR/hardened.json")"

echo
echo "==================================================================="
echo "STATE 3 — half-fixed box (fix-half.sh: uid0, sudo, pwquality"
echo "          (minlen+credits), faillock, shadow-mode, sysctl-ip-forward"
echo "          only (partial sysctl write) = 12+10+10+10+8+8+8 = 66 pts)"
echo "==================================================================="
start_container half
docker exec "rz-practice-half" /opt/fixes/fix-half.sh
score half
assert_eq "state3 totalEarned (exactly the 7 fixed checks, no partial credit)" 66 "$(total_earned "$WORKDIR/half.json")"
assert_eq "state3 passing checks (7 fixed + 3 decoys)" 10 "$(pass_count "$WORKDIR/half.json")"
assert_eq "state3 sysctl-ip-forward passes (the line that was written)" true "$(check_pass "$WORKDIR/half.json" sysctl-ip-forward)"
assert_eq "state3 sysctl-rp-filter still fails (partial write, no bleed)" false "$(check_pass "$WORKDIR/half.json" sysctl-rp-filter)"
assert_eq "state3 sysctl-accept-redirects still fails (partial write, no bleed)" false "$(check_pass "$WORKDIR/half.json" sysctl-accept-redirects)"

echo
echo "==================================================================="
echo "STATE 4 — alternate-valid fixes (drop-ins / alternate locations,"
echo "          never the primary/canonical file each vuln's fix-all.sh"
echo "          script edits)"
echo "==================================================================="
start_container altfix
docker exec "rz-practice-altfix" /opt/fixes/fix-ssh-dropin.sh
docker exec "rz-practice-altfix" /opt/fixes/fix-ssh-limits.sh
docker exec "rz-practice-altfix" /opt/fixes/fix-pwhistory-alt.sh
score altfix
assert_eq "state4 ssh-permitrootlogin passes via merged config" true "$(check_pass "$WORKDIR/altfix.json" ssh-permitrootlogin)"
assert_eq "state4 ssh-maxauthtries passes via the drop-in" true "$(check_pass "$WORKDIR/altfix.json" ssh-maxauthtries)"
assert_eq "state4 ssh-x11forwarding passes via the drop-in" true "$(check_pass "$WORKDIR/altfix.json" ssh-x11forwarding)"
assert_eq "state4 pwhistory-remember passes via the alternate (common-password) location" true "$(check_pass "$WORKDIR/altfix.json" pwhistory-remember)"
assert_eq "state4 totalEarned (12+8+8+8, only these four checks fixed)" 36 "$(total_earned "$WORKDIR/altfix.json")"

echo
echo "==================================================================="
echo "BONUS — proves the traps are real: editing ONLY the main sshd_config"
echo "        (never the drop-ins) must NOT fix any of the three SSH"
echo "        checks, since the drop-ins win"
echo "==================================================================="
start_container trap-demo
docker exec "rz-practice-trap-demo" sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
docker exec "rz-practice-trap-demo" sed -i \
  -e 's/^#\?MaxAuthTries.*/MaxAuthTries 4/' \
  -e 's/^X11Forwarding.*/X11Forwarding no/' \
  /etc/ssh/sshd_config
score trap-demo
assert_eq "bonus ssh-permitrootlogin still fails (drop-in still says yes)" false "$(check_pass "$WORKDIR/trap-demo.json" ssh-permitrootlogin)"
assert_eq "bonus ssh-maxauthtries still fails (drop-in still wins)" false "$(check_pass "$WORKDIR/trap-demo.json" ssh-maxauthtries)"
assert_eq "bonus ssh-x11forwarding still fails (drop-in still wins)" false "$(check_pass "$WORKDIR/trap-demo.json" ssh-x11forwarding)"

echo
if [ "$fail" -ne 0 ]; then
  echo "==================================================================="
  echo "PROVE.SH: FAILED — one or more assertions above did not hold."
  echo "==================================================================="
  exit 1
fi
echo "==================================================================="
echo "PROVE.SH: all four states + the bonus trap demo scored as expected."
echo "==================================================================="
