#!/bin/bash
# Remediates: empty-password
set -eu
usermod -p '!' zzsync
