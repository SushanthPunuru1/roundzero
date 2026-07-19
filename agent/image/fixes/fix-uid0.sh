#!/bin/bash
# Remediates: uid0-backdoor
#
# -f is required, not just belt-and-suspenders: backdoor shares uid 0 with
# root, and root owns PID 1 in this container, so a plain `userdel` refuses
# with "user backdoor is currently used by process 1" — it's checking the
# uid, not the username.
set -eu
userdel -f backdoor
