# shellcheck shell=bash
# Project-specific deploy manifest for csmon. Version with the repo; copy this tree to replicate slot behaviour on another host.

CSMON_DEPLOY_MANIFEST_VERSION=1
CSMON_PROJECT_NAME="csmon"

# Ports (production is fixed; pre-production is the test slot)
CSMON_PORT_PRODUCTION=3000
CSMON_PORT_PREPRODUCTION=3010
CSMON_BIND_HOST="0.0.0.0"

# Runtime: docker | node | ask (menu picks once, stored in deploy state)
CSMON_DEFAULT_RUNTIME="ask"

# --- Always retain (never replaced by pull/build/promote code swaps) ---
# Environment secrets and operator config (see .env.example)
CSMON_RETAIN_ENV_FILES=(
  ".env.local"
  ".env"
)

# Live production persistence root (relative to slot tree root unless absolute)
CSMON_DATA_DIR_NAME="data"

# Files under the data directory preserved when snapshotting or documenting retention
CSMON_RETAIN_DATA_GLOBS=(
  "csmon.sqlite"
  "csmon.sqlite-wal"
  "csmon.sqlite-shm"
  "overrides"
  "overrides/feeds.json"
)

# Paths excluded when copying/syncing application source between slots
CSMON_COPY_EXCLUDE=(
  ".git"
  "node_modules"
  ".next"
  "out"
  "build"
  ".pnpm-store"
  "data"
  ".env.local"
  ".env"
  ".vercel"
  "coverage"
  "*.sqlite"
  "*.sqlite-wal"
  "*.sqlite-shm"
)

# --- Docker ---
CSMON_DOCKER_IMAGE="csmon:local"
CSMON_DOCKER_COMPOSE_FILE="docker-compose.yml"
CSMON_DOCKER_SERVICE="csmon"

# --- Node ---
CSMON_NODE_PM="pnpm"
CSMON_NODE_INSTALL="pnpm install --frozen-lockfile"
CSMON_NODE_BUILD="pnpm generate-sbom && pnpm build"
CSMON_NODE_START="pnpm start"

# Health check path (used after start)
CSMON_HEALTH_PATH="/api/health"
