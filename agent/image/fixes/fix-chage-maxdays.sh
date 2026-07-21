#!/bin/bash
# Remediates: chage-maxdays
set -eu
sed -i 's/^PASS_MAX_DAYS.*/PASS_MAX_DAYS   90/' /etc/login.defs
