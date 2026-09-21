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
      curl -fsS "http://127.0.0.1:${PORT:-3000}/api/update" || fail "app is not reachable on :${PORT:-3000}"
      echo
    else
      fail "curl is required for check"
    fi
    ;;
  docker)
    command -v docker >/dev/null 2>&1 || fail "docker is not installed"
    docker compose build
    docker compose up -d
    echo "csmon container rebuilt and started. Open http://127.0.0.1:3000"
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
