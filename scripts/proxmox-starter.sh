#!/usr/bin/env bash
# csmon Proxmox starter — install and update on an Ubuntu 24.04 LXC/VM with Docker.
#
# Run on the guest (SSH or Proxmox console), not on the Proxmox host hypervisor.
#
# Quick start (clone repo first):
#   git clone https://github.com/womail/csmon.git /opt/csmon
#   sudo bash /opt/csmon/scripts/proxmox-starter.sh install
#
# Or one-liner (installs to /opt/csmon):
#   curl -fsSL https://raw.githubusercontent.com/womail/csmon/main/scripts/proxmox-starter.sh | sudo bash -s -- install
#
# Later updates (resets /opt/csmon to origin/main; set CSMON_GIT_BRANCH to follow another branch):
#   sudo /opt/csmon/scripts/proxmox-starter.sh update
#
# If the on-disk starter is stale, curl the copy from GitHub so fetch/reset cannot be skipped:
#   curl -fsSL https://raw.githubusercontent.com/womail/csmon/main/scripts/proxmox-starter.sh | sudo bash -s -- update
#
# Environment (optional):
#   CSMON_INSTALL_DIR   default /opt/csmon
#   CSMON_GIT_REPO      default https://github.com/womail/csmon.git
#   CSMON_GIT_BRANCH    default main
#   CSMON_SKIP_DOCKER   set 1 if Docker is already installed
#   CSMON_SKIP_GIT      set 1 if the caller already refreshed the tree
#   CSMON_COMPOSE_LAN   default 1 — publish 0.0.0.0:3000 (docker-compose.lan.yml)
#
set -euo pipefail

CSMON_INSTALL_DIR="${CSMON_INSTALL_DIR:-/opt/csmon}"
CSMON_GIT_REPO="${CSMON_GIT_REPO:-https://github.com/womail/csmon.git}"
CSMON_GIT_BRANCH="${CSMON_GIT_BRANCH:-main}"
CSMON_COMPOSE_LAN="${CSMON_COMPOSE_LAN:-1}"
CSMON_SKIP_DOCKER="${CSMON_SKIP_DOCKER:-0}"
CSMON_SKIP_GIT="${CSMON_SKIP_GIT:-0}"

# `curl | bash` has no script file, so BASH_SOURCE is unset under `set -u`.
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
  SCRIPT_ROOT="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)"
else
  SCRIPT_PATH=""
  SCRIPT_ROOT=""
fi

log() { printf 'csmon-proxmox: %s\n' "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

as_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    die "run as root or install sudo"
  fi
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    die "Docker Compose is not available"
  fi
}

compose_files() {
  echo "-f ${1}/docker-compose.yml"
}

compose_env() {
  if [[ "$CSMON_COMPOSE_LAN" == "1" ]]; then
    export CSMON_PUBLISH_IP=0.0.0.0
  else
    export CSMON_PUBLISH_IP=127.0.0.1
  fi
}

install_docker() {
  if [[ "$CSMON_SKIP_DOCKER" == "1" ]]; then
    need_cmd docker
    return
  fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    log "Docker already installed"
    return
  fi
  log "Installing Docker (Ubuntu/Debian get.docker.com script)…"
  need_cmd curl
  as_root bash -c 'curl -fsSL https://get.docker.com | sh'
  if [[ "${EUID}" -ne 0 ]] && getent group docker >/dev/null 2>&1; then
    log "Adding ${USER} to group docker (log out and back in for it to apply)"
    as_root usermod -aG docker "${USER}" || true
  fi
}

resolve_install_dir() {
  if [[ -f "${SCRIPT_ROOT}/Dockerfile" && -f "${SCRIPT_ROOT}/docker-compose.yml" ]]; then
    echo "${SCRIPT_ROOT}"
    return
  fi
  echo "${CSMON_INSTALL_DIR}"
}

ensure_repo() {
  local dir="$1"
  if [[ -f "${dir}/Dockerfile" && -f "${dir}/docker-compose.yml" ]]; then
    log "Using existing tree at ${dir}"
    return
  fi
  need_cmd git
  if [[ -d "${dir}/.git" ]]; then
    log "Git repo present at ${dir}"
    return
  fi
  log "Cloning ${CSMON_GIT_REPO} → ${dir} (branch ${CSMON_GIT_BRANCH})"
  as_root mkdir -p "$(dirname "$dir")"
  as_root git clone --branch "${CSMON_GIT_BRANCH}" --depth 1 "${CSMON_GIT_REPO}" "${dir}"
}

seed_env_file() {
  local dir="$1"
  if [[ -f "${dir}/.env" ]]; then
    return
  fi
  if [[ -f "${dir}/.env.example" ]]; then
    log "Creating ${dir}/.env from .env.example — set CSMON_TOKEN for LAN exposure"
    cp "${dir}/.env.example" "${dir}/.env"
  fi
}

compose_run() {
  local dir="$1"
  shift
  local files compose
  files="$(compose_files "$dir")"
  compose="$(compose_cmd)"
  compose_env
  # shellcheck disable=SC2086
  (cd "$dir" && as_root env \
    CSMON_PUBLISH_IP="${CSMON_PUBLISH_IP}" \
    CSMON_GIT_SHA="${CSMON_GIT_SHA:-unknown}" \
    ${compose} ${files} "$@")
}

mark_safe_git() {
  local dir="$1"
  as_root git config --global --add safe.directory "$dir" 2>/dev/null || true
}

# Shallow appliance clones cannot git pull --ff-only: the old tip is not an ancestor
# of a depth-1 fetch. `git fetch origin main` also leaves origin/main stale on some
# git versions — always reset to FETCH_HEAD.
refresh_repo() {
  local dir="$1"
  local before after subject
  if [[ "$CSMON_SKIP_GIT" == "1" ]]; then
    if [[ -z "${CSMON_GIT_SHA:-}" && -d "${dir}/.git" ]]; then
      CSMON_GIT_SHA="$(as_root git -C "$dir" rev-parse --short HEAD 2>/dev/null || echo unknown)"
      export CSMON_GIT_SHA
    fi
    return
  fi
  [[ -d "${dir}/.git" ]] || die "no git repo at ${dir} — run install first"
  need_cmd git
  mark_safe_git "$dir"

  before="$(as_root git -C "$dir" rev-parse --short HEAD 2>/dev/null || echo none)"
  log "Updating ${dir} to origin/${CSMON_GIT_BRANCH} (was ${before})"

  if ! as_root env GIT_TERMINAL_PROMPT=0 git -C "$dir" fetch --prune --depth 1 origin \
    "+${CSMON_GIT_BRANCH}:refs/remotes/origin/${CSMON_GIT_BRANCH}"; then
    log "Fetch failed — resetting origin to ${CSMON_GIT_REPO}"
    as_root git -C "$dir" remote set-url origin "${CSMON_GIT_REPO}"
    as_root env GIT_TERMINAL_PROMPT=0 git -C "$dir" fetch --prune --depth 1 origin \
      "+${CSMON_GIT_BRANCH}:refs/remotes/origin/${CSMON_GIT_BRANCH}"
  fi

  as_root git -C "$dir" checkout -f -B "${CSMON_GIT_BRANCH}" FETCH_HEAD
  as_root git -C "$dir" reset --hard FETCH_HEAD

  after="$(as_root git -C "$dir" rev-parse --short HEAD)"
  subject="$(as_root git -C "$dir" log -1 --format=%s)"
  export CSMON_GIT_SHA="$after"
  if [[ "$before" == "$after" ]]; then
    log "Already at ${after} — ${subject}"
  else
    log "Source ${before} → ${after} — ${subject}"
  fi
}

stamp_build_info() {
  local dir="$1"
  local sha date
  sha="${CSMON_GIT_SHA:-}"
  if [[ -z "$sha" || "$sha" == "unknown" ]]; then
    sha="$(as_root git -C "$dir" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  fi
  date="$(as_root git -C "$dir" log -1 --format=%cI 2>/dev/null | cut -c1-10 || date -u +%F)"
  export CSMON_GIT_SHA="$sha"
  as_root tee "${dir}/lib/build-info.generated.ts" >/dev/null <<EOF
/** Generated by scripts/proxmox-starter.sh — do not edit. */
export const APP_BUILD_COMMIT = "${sha}";
export const APP_BUILD_DATE = "${date}";
EOF
}

# After git reset, run the starter that was just pulled so compose/build logic is current.
reexec_updated_starter() {
  local dir="$1"
  local self="${dir}/scripts/proxmox-starter.sh"
  if [[ "${CSMON_UPDATE_REEXEC:-0}" == "1" || ! -f "$self" ]]; then
    return
  fi
  log "Continuing with the pulled starter at ${self}"
  if [[ "${EUID}" -eq 0 ]]; then
    exec env \
      CSMON_UPDATE_REEXEC=1 \
      CSMON_SKIP_GIT=1 \
      CSMON_INSTALL_DIR="$dir" \
      CSMON_GIT_REPO="${CSMON_GIT_REPO}" \
      CSMON_GIT_BRANCH="${CSMON_GIT_BRANCH}" \
      CSMON_COMPOSE_LAN="${CSMON_COMPOSE_LAN}" \
      CSMON_SKIP_DOCKER="${CSMON_SKIP_DOCKER}" \
      CSMON_GIT_SHA="${CSMON_GIT_SHA:-}" \
      bash "$self" update
  fi
  exec sudo env \
    CSMON_UPDATE_REEXEC=1 \
    CSMON_SKIP_GIT=1 \
    CSMON_INSTALL_DIR="$dir" \
    CSMON_GIT_REPO="${CSMON_GIT_REPO}" \
    CSMON_GIT_BRANCH="${CSMON_GIT_BRANCH}" \
    CSMON_COMPOSE_LAN="${CSMON_COMPOSE_LAN}" \
    CSMON_SKIP_DOCKER="${CSMON_SKIP_DOCKER}" \
    CSMON_GIT_SHA="${CSMON_GIT_SHA:-}" \
    bash "$self" update
}

free_port_3000() {
  if command -v ss >/dev/null 2>&1 && ss -tln | grep -q ':3000 '; then
    log "Port 3000 still in use — removing leftover csmon containers"
    as_root docker ps -aq --filter 'name=csmon' | xargs -r docker rm -f 2>/dev/null || true
  fi
}

compose_build() {
  local dir="$1"
  if [[ -z "${CSMON_GIT_SHA:-}" ]]; then
    CSMON_GIT_SHA="$(as_root git -C "$dir" rev-parse --short HEAD 2>/dev/null || echo unknown)"
    export CSMON_GIT_SHA
  fi
  compose_run "$dir" pull ubuntu || log "Ubuntu pull skipped — using the local image if present"
  compose_run "$dir" build --pull --build-arg "CSMON_GIT_SHA=${CSMON_GIT_SHA}"
}

compose_start() {
  local dir="$1"
  free_port_3000
  compose_run "$dir" up -d --force-recreate --remove-orphans
}

# First install: drop a half-built stack, then build and start.
compose_up() {
  local dir="$1"
  compose_run "$dir" down --remove-orphans 2>/dev/null || true
  compose_build "$dir"
  compose_start "$dir"
}

# Update: build the new image first so a failed rebuild leaves the running app up.
# If the build OOMs beside a live container, stop once and retry.
compose_update() {
  local dir="$1"
  if compose_build "$dir"; then
    compose_start "$dir"
    return
  fi
  log "Build failed — stopping the running app to free memory and retrying"
  compose_run "$dir" down --remove-orphans 2>/dev/null || true
  compose_build "$dir"
  compose_start "$dir"
}

wait_health() {
  local url="${1:-http://127.0.0.1:3000/api/health}"
  local dir="${2:-}"
  local i
  for i in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "Health OK: ${url}"
      return 0
    fi
    sleep 2
  done
  if [[ -n "$dir" ]]; then
    log "Last container logs:"
    compose_run "$dir" logs --tail=80 csmon || true
  fi
  die "health check timed out: ${url} (try: logs)"
}

cmd_install() {
  install_docker
  local dir
  dir="$(resolve_install_dir)"
  ensure_repo "$dir"
  seed_env_file "$dir"
  stamp_build_info "$dir"
  log "Building and starting csmon (LAN port 3000 when CSMON_COMPOSE_LAN=1)…"
  compose_up "$dir"
  wait_health "http://127.0.0.1:3000/api/health" "$dir"
  print_access "$dir"
}

cmd_update() {
  install_docker
  local dir
  dir="$(resolve_install_dir)"
  refresh_repo "$dir"
  stamp_build_info "$dir"
  reexec_updated_starter "$dir"
  seed_env_file "$dir"
  log "Rebuilding container at ${CSMON_GIT_SHA:-unknown} (SQLite volume unchanged)…"
  compose_update "$dir"
  wait_health "http://127.0.0.1:3000/api/health" "$dir"
  print_access "$dir"
}

cmd_status() {
  local dir
  dir="$(resolve_install_dir)"
  local compose files
  compose="$(compose_cmd)"
  files="$(compose_files "$dir")"
  # shellcheck disable=SC2086
  (cd "$dir" && ${compose} ${files} ps)
  curl -fsS "http://127.0.0.1:3000/api/health" && echo || log "health endpoint not responding"
}

cmd_logs() {
  local dir
  dir="$(resolve_install_dir)"
  local compose files
  compose="$(compose_cmd)"
  files="$(compose_files "$dir")"
  # shellcheck disable=SC2086
  (cd "$dir" && ${compose} ${files} logs -f --tail=200 csmon)
}

cmd_restart() {
  local dir
  dir="$(resolve_install_dir)"
  local compose files
  compose="$(compose_cmd)"
  files="$(compose_files "$dir")"
  # shellcheck disable=SC2086
  (cd "$dir" && as_root ${compose} ${files} restart csmon)
  wait_health "http://127.0.0.1:3000/api/health" "$dir"
}

cmd_stop() {
  local dir
  dir="$(resolve_install_dir)"
  local compose files
  compose="$(compose_cmd)"
  files="$(compose_files "$dir")"
  # shellcheck disable=SC2086
  (cd "$dir" && as_root ${compose} ${files} down)
}

print_access() {
  local dir="$1"
  local ip=""
  if command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  log "Install directory: ${dir}"
  log "Tree:   $(as_root git -C "$dir" rev-parse --short HEAD 2>/dev/null || echo unknown) (branch ${CSMON_GIT_BRANCH})"
  log "Local:  http://127.0.0.1:3000"
  if [[ -n "$ip" ]]; then
    log "LAN:    http://${ip}:3000"
  fi
  if command -v curl >/dev/null 2>&1; then
    log "Running: $(curl -fsS http://127.0.0.1:3000/api/version 2>/dev/null || echo 'version endpoint not ready')"
  fi
  log "Data:   Docker volume csmon-data (see ${dir}/DOCKER.md)"
  log "Update: sudo ${dir}/scripts/proxmox-starter.sh update"
  log "Set CSMON_TOKEN in ${dir}/.env and uncomment in docker-compose if the LAN is not trusted."
}

usage() {
  cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  install     Install Docker (if needed), clone/use repo, build, start on port 3000
  update      reset to origin/${CSMON_GIT_BRANCH:-main} + rebuild + restart (keeps csmon-data volume)
  status      compose ps + health check
  logs        follow csmon container logs
  restart     restart csmon service
  stop        docker compose down

Proxmox LXC: enable nesting if the build fails (Features → nesting on).

EOF
}

main() {
  local cmd="${1:-install}"
  case "$cmd" in
    install) cmd_install ;;
    update) cmd_update ;;
    status) cmd_status ;;
    logs) cmd_logs ;;
    restart) cmd_restart ;;
    stop) cmd_stop ;;
    -h | --help | help) usage ;;
    *) usage; die "unknown command: $cmd" ;;
  esac
}

main "${@:-install}"
