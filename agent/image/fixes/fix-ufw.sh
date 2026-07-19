#!/bin/bash
# Remediates: ufw-active
set -eu
ufw --force enable >/dev/null
