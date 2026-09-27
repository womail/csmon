#!/bin/sh
set -e
DATA="${CSMON_DATA_DIR:-/app/data}"
mkdir -p "$DATA"
# Next.js standalone listens on $HOSTNAME. Docker/Compose often set HOSTNAME to a
# container name or a LAN IP that is not bindable inside the network namespace.
export HOSTNAME="${CSMON_BIND_HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"
exec "$@"
