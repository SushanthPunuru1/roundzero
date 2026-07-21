#!/bin/bash
# Remediates: insecure-service-vsftpd
set -eu
apt-get purge -y vsftpd >/dev/null
