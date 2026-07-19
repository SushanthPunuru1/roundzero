#!/bin/bash
# Applies exactly 5 of the 10 remediations — the "half-fixed" harness
# state. scripts/prove.sh independently sums these 5 checks' points from
# ../checks/linux-practice.yaml and asserts the score matches exactly, to
# catch any partial-credit bug.
set -eu
DIR="$(dirname "$0")"
"$DIR/fix-uid0.sh"
"$DIR/fix-unauthorized-sudo.sh"
"$DIR/fix-pwquality.sh"
"$DIR/fix-faillock.sh"
"$DIR/fix-shadow-mode.sh"
