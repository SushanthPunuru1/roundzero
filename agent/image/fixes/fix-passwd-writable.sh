#!/bin/bash
# Remediates: passwd-writable
set -eu
chmod 644 /etc/passwd
