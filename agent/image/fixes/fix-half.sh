#!/bin/bash
# Applies a deterministic subset of remediations — the "half-fixed" harness
# state. scripts/prove.sh independently sums the resulting passing checks'
# points from ../checks/linux-practice.yaml and asserts the score matches
# exactly, to catch any partial-credit bug.
#
# fix-pwquality.sh credits BOTH pwquality-minlen (10) and pwquality-credits
# (10) — the same edit satisfies both, a realistic overlap, not a bug (see
# the check-file comment on pwquality-credits). fix-sysctl-partial.sh writes
# ONLY the ip_forward line, deliberately leaving sysctl-rp-filter and
# sysctl-accept-redirects still failing — proves a partial write to a
# multi-check file credits only the check whose line was actually written.
#
# Passing: uid0-backdoor(12) + unauthorized-sudo(10) + pwquality-minlen(10)
# + pwquality-credits(10) + faillock-deny(8) + shadow-mode(8) +
# sysctl-ip-forward(8) = 66, across 7 scored checks (+ 3 decoys).
set -eu
DIR="$(dirname "$0")"
"$DIR/fix-uid0.sh"
"$DIR/fix-unauthorized-sudo.sh"
"$DIR/fix-pwquality.sh"
"$DIR/fix-faillock.sh"
"$DIR/fix-shadow-mode.sh"
"$DIR/fix-sysctl-partial.sh"
