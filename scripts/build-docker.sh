#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

echo "=== csmon: pull Ubuntu Server 24.04 and deploy ==="

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed or not on PATH" >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose=(docker-compose)
else
  echo "Docker Compose is not available" >&2
  exit 1
fi

echo "Pulling docker.io/library/ubuntu:24.04..."
"${compose[@]}" pull ubuntu
docker pull docker.io/library/ubuntu:24.04

echo "Building csmon on that Ubuntu image and starting the container..."
"${compose[@]}" build --pull
"${compose[@]}" up -d

echo
echo "csmon is running at http://127.0.0.1:3000"
echo "SQLite data stays in the csmon-data volume."
echo
echo "Logs:  ${compose[*]} logs -f csmon"
echo "Stop:  ${compose[*]} down"
