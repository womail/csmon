#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mode="${1:-git}"

fail() {
  echo "update: $*" >&2
  exit 1
}

case "$mode" in
  check)
    if command -v curl >/dev/null 2>&1; then
      base="${CSMON_UPDATE_CHECK_URL:-http://127.0.0.1:${PORT:-3000}}"
      curl -fsS "${base%/}/api/update" || fail "app is not reachable at ${base%/}/api/update"
      echo
    else
      fail "curl is required for check"
    fi
    ;;
  docker)
    command -v docker >/dev/null 2>&1 || fail "docker is not installed"
    bash "$ROOT/scripts/build-docker.sh"
    echo "csmon container is up on Ubuntu 24.04. Open http://127.0.0.1:3000"
    ;;
  git)
    command -v git >/dev/null 2>&1 || fail "git is not installed"
    git fetch origin
    git pull --ff-only
    pnpm install --frozen-lockfile
    pnpm generate-sbom
    pnpm build
    echo "Build is ready. Restart with: pnpm start"
    echo "Or rebuild the container: scripts/update.sh docker"
    ;;
  *)
    fail "usage: scripts/update.sh [git|docker|check]"
    ;;
esac
