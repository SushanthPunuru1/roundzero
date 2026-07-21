#!/bin/bash
# Remediates: pwhistory-remember — via the ALTERNATE location, proving
# pwhistory-remember credits either valid fix spot (PART 3 state 4 in
# agent/README.md). pwhistory.conf is deliberately left untouched here: this
# script exists only to demonstrate the check reads common-password too, not
# to be part of fix-all.sh's canonical path (fix-pwhistory.sh is that).
set -eu
awk '
  { print }
  /pam_pwquality\.so/ && !done {
    print "password\trequisite\t\t\tpam_pwhistory.so remember=5 use_authtok"
    done = 1
  }
' /etc/pam.d/common-password > /etc/pam.d/common-password.new
mv /etc/pam.d/common-password.new /etc/pam.d/common-password
