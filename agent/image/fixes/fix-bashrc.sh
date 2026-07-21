#!/bin/bash
# Remediates: bashrc-payload
set -eu
sed -i '\#/dev/tcp/#d' /root/.bashrc
