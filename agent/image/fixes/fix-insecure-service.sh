#!/bin/bash
# Remediates: insecure-service-absent
set -eu
apt-get purge -y telnetd >/dev/null
