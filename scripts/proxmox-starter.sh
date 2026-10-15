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
# Later updates:
#   sudo /opt/csmon/scripts/proxmox-starter.sh update
#
# Environment (optional):
#   CSMON_INSTALL_DIR   default /opt/csmon
#   CSMON_GIT_REPO      default https://github.com/womail/csmon.git
#   CSMON_GIT_BRANCH    default main
#   CSMON_SKIP_DOCKER   set 1 if Docker is already installed
#   CSMON_COMPOSE_LAN   default 1 — publish 0.0.0.0:3000 (docker-compose.lan.yml)
#
set -euo pipefail

CSMON_INSTALL_DIR="${CSMON_INSTALL_DIR:-/opt/csmon}"
CSMON_GIT_REPO="${CSMON_GIT_REPO:-https://github.com/womail/csmon.git}"
CSMON_GIT_BRANCH="${CSMON_GIT_BRANCH:-main}"
CSMON_COMPOSE_LAN="${CSMON_COMPOSE_LAN:-1}"
CSMON_SKIP_DOCKER="${CSMON_SKIP_DOCKER:-0}"

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_ROOT="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)"

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
  local dir="$1"
  if [[ "$CSMON_COMPOSE_LAN" == "1" && -f "${dir}/docker-compose.lan.yml" ]]; then
    echo "-f ${dir}/docker-compose.yml -f ${dir}/docker-compose.lan.yml"
  else
    echo "-f ${dir}/docker-compose.yml"
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

compose_up() {
  local dir="$1"
  local files
  files="$(compose_files "$dir")"
  local compose
  compose="$(compose_cmd)"
  # shellcheck disable=SC2086
  (cd "$dir" && as_root ${compose} ${files} pull ubuntu)
  # shellcheck disable=SC2086
  (cd "$dir" && as_root ${compose} ${files} build --pull)
  # shellcheck disable=SC2086
  (cd "$dir" && as_root ${compose} ${files} up -d)
}

wait_health() {
  local url="${1:-http://127.0.0.1:3000/api/health}"
  local i
  for i in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "Health OK: ${url}"
      return 0
    fi
    sleep 2
  done
  die "health check timed out: ${url} (try: logs)"
}

cmd_install() {
  install_docker
  local dir
  dir="$(resolve_install_dir)"
  ensure_repo "$dir"
  seed_env_file "$dir"
  log "Building and starting csmon (LAN port 3000 when CSMON_COMPOSE_LAN=1)…"
  compose_up "$dir"
  wait_health "http://127.0.0.1:3000/api/health"
  print_access "$dir"
}

cmd_update() {
  install_docker
  local dir
  dir="$(resolve_install_dir)"
  [[ -d "${dir}/.git" ]] || die "no git repo at ${dir} — run install first"
  need_cmd git
  log "Pulling latest ${CSMON_GIT_BRANCH} in ${dir}"
  (cd "$dir" && git fetch origin && git pull --ff-only origin "${CSMON_GIT_BRANCH}")
  log "Rebuilding container (SQLite volume unchanged)…"
  compose_up "$dir"
  wait_health "http://127.0.0.1:3000/api/health"
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
  wait_health "http://127.0.0.1:3000/api/health"
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
  log "Local:  http://127.0.0.1:3000"
  if [[ -n "$ip" ]]; then
    log "LAN:    http://${ip}:3000"
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
  update      git pull + rebuild + restart (keeps csmon-data volume)
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
