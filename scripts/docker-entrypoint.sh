#!/bin/sh
set -e
DATA="${CSMON_DATA_DIR:-/app/data}"
mkdir -p "$DATA"
chown -R nextjs:nodejs "$DATA"
exec runuser -u nextjs -- "$@"
