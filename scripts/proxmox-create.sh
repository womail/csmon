#!/usr/bin/env bash
# Legacy Proxmox host helper (env file + pct). Prefer Community Scripts for the full wizard:
#   bash -c "$(curl -fsSL …/scripts/community-scripts/ct/csmon.sh)"
# See scripts/community-scripts/README.md
#
# Create a Proxmox LXC for csmon, configure networking, install Docker + app, and support updates.
#
# Run on the **Proxmox host** as root (SSH to pve, not inside a guest):
#   scp scripts/proxmox-create.env.example root@pve:/etc/csmon/proxmox-create.env
#   # edit CSMON_IP / CSMON_GW
#   bash scripts/proxmox-create.sh create
#
# Update csmon inside the existing container:
#   bash scripts/proxmox-create.sh update
#
# State: /var/lib/csmon-proxmox/state.env (CTID, IP, hostname)
#
set -euo pipefail

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
STATE_DIR="${CSMON_STATE_DIR:-/var/lib/csmon-proxmox}"
STATE_FILE="${STATE_DIR}/state.env"

# Defaults (override via /etc/csmon/proxmox-create.env or environment)
CSMON_CT_NAME="${CSMON_CT_NAME:-csmon}"
CSMON_STORAGE="${CSMON_STORAGE:-local-lvm}"
CSMON_TEMPLATE_STORAGE="${CSMON_TEMPLATE_STORAGE:-local}"
CSMON_BRIDGE="${CSMON_BRIDGE:-vmbr0}"
CSMON_MEMORY="${CSMON_MEMORY:-4096}"
CSMON_CORES="${CSMON_CORES:-4}"
CSMON_DISK="${CSMON_DISK:-32}"
CSMON_SWAP="${CSMON_SWAP:-512}"
CSMON_DNS="${CSMON_DNS:-1.1.1.1}"
CSMON_GIT_REPO="${CSMON_GIT_REPO:-https://github.com/womail/csmon.git}"
CSMON_GIT_BRANCH="${CSMON_GIT_BRANCH:-main}"
CSMON_INSTALL_DIR="${CSMON_INSTALL_DIR:-/opt/csmon}"
CSMON_LXC_PRIVILEGED="${CSMON_LXC_PRIVILEGED:-0}"
CSMON_STARTER_URL="${CSMON_STARTER_URL:-https://raw.githubusercontent.com/womail/csmon/main/scripts/proxmox-starter.sh}"
CSMON_UBUNTU_TEMPLATE="${CSMON_UBUNTU_TEMPLATE:-ubuntu-24.04-standard}"

log() { printf 'csmon-pve: %s\n' "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

load_config() {
  local f
  for f in /etc/csmon/proxmox-create.env "${SCRIPT_DIR}/proxmox-create.env"; do
    if [[ -f "$f" ]]; then
      # shellcheck disable=SC1090
      set -a && source "$f" && set +a
      log "Loaded config from $f"
      return
    fi
  done
}

require_pve() {
  [[ "${EUID}" -eq 0 ]] || die "run as root on the Proxmox node"
  command -v pct >/dev/null 2>&1 || die "pct not found — is this a Proxmox host?"
  command -v pveam >/dev/null 2>&1 || die "pveam not found"
}

write_state() {
  mkdir -p "$STATE_DIR"
  cat >"$STATE_FILE" <<EOF
CSMON_CTID=${CSMON_CTID}
CSMON_CT_NAME=${CSMON_CT_NAME}
CSMON_IP=${CSMON_IP:-}
CSMON_INSTALL_DIR=${CSMON_INSTALL_DIR}
CSMON_GIT_REPO=${CSMON_GIT_REPO}
CSMON_GIT_BRANCH=${CSMON_GIT_BRANCH}
EOF
  chmod 600 "$STATE_FILE"
}

load_state() {
  [[ -f "$STATE_FILE" ]] || die "no state at ${STATE_FILE} — run create first"
  # shellcheck disable=SC1090
  set -a && source "$STATE_FILE" && set +a
  [[ -n "${CSMON_CTID:-}" ]] || die "state file missing CSMON_CTID"
}

next_free_ctid() {
  local id="${CSMON_CTID:-100}"
  if [[ -n "${CSMON_CTID:-}" ]]; then
    echo "$CSMON_CTID"
    return
  fi
  while pct status "$id" &>/dev/null; do
    id=$((id + 1))
  done
  echo "$id"
}

ensure_ubuntu_template() {
  local vol
  vol="$(pveam list "${CSMON_TEMPLATE_STORAGE}" 2>/dev/null | awk -v pat="${CSMON_UBUNTU_TEMPLATE}" '$0 ~ pat {print $1; exit}')"
  if [[ -n "$vol" ]]; then
    log "Using template ${vol}"
    echo "$vol"
    return
  fi
  log "Downloading ${CSMON_UBUNTU_TEMPLATE} to ${CSMON_TEMPLATE_STORAGE}…"
  pveam update || true
  pveam download "${CSMON_TEMPLATE_STORAGE}" "${CSMON_UBUNTU_TEMPLATE}"
  vol="$(pveam list "${CSMON_TEMPLATE_STORAGE}" | awk -v pat="${CSMON_UBUNTU_TEMPLATE}" '$0 ~ pat {print $1; exit}')"
  [[ -n "$vol" ]] || die "template download failed"
  echo "$vol"
}

net0_spec() {
  local spec="name=eth0,bridge=${CSMON_BRIDGE}"
  if [[ -n "${CSMON_IP:-}" ]]; then
    [[ -n "${CSMON_GW:-}" ]] || die "CSMON_GW is required when CSMON_IP is set"
    spec="${spec},ip=${CSMON_IP},gw=${CSMON_GW}"
  else
    spec="${spec},ip=dhcp"
  fi
  echo "$spec"
}

lxc_features() {
  if [[ "$CSMON_LXC_PRIVILEGED" == "1" ]]; then
    echo "nesting=1,keyctl=1"
  else
    echo "nesting=1,keyctl=1,fuse=1"
  fi
}

container_exists() {
  pct status "$1" &>/dev/null
}

wait_container_network() {
  local ctid="$1"
  local i
  for i in $(seq 1 45); do
    if pct exec "$ctid" -- ping -c1 -W2 "${CSMON_DNS%% *}" >/dev/null 2>&1 \
      || pct exec "$ctid" -- ping -c1 -W2 github.com >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  die "container ${ctid} has no outbound network (check IP/gw/DNS)"
}

guest_bootstrap_packages() {
  local ctid="$1"
  log "Installing git/curl inside CT ${ctid}…"
  pct exec "$ctid" -- bash -c '
    set -euo pipefail
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq git curl ca-certificates
  '
}

guest_ssh_key() {
  local ctid="$1"
  [[ -n "${CSMON_SSH_PUBKEY:-}" ]] || return 0
  log "Installing SSH public key for root"
  pct exec "$ctid" -- bash -c "
    set -euo pipefail
    mkdir -p /root/.ssh
    chmod 700 /root/.ssh
    grep -Fq '${CSMON_SSH_PUBKEY}' /root/.ssh/authorized_keys 2>/dev/null || echo '${CSMON_SSH_PUBKEY}' >> /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
  "
}

guest_run_starter() {
  local ctid="$1"
  local subcmd="$2"
  log "Running proxmox-starter.sh ${subcmd} on CT ${ctid}…"
  pct exec "$ctid" -- env \
    CSMON_INSTALL_DIR="${CSMON_INSTALL_DIR}" \
    CSMON_GIT_REPO="${CSMON_GIT_REPO}" \
    CSMON_GIT_BRANCH="${CSMON_GIT_BRANCH}" \
    CSMON_COMPOSE_LAN=1 \
    bash -c "curl -fsSL '${CSMON_STARTER_URL}' | bash -s -- ${subcmd}"
}

guest_run_starter_local() {
  local ctid="$1"
  local subcmd="$2"
  pct exec "$ctid" -- env \
    CSMON_INSTALL_DIR="${CSMON_INSTALL_DIR}" \
    CSMON_GIT_REPO="${CSMON_GIT_REPO}" \
    CSMON_GIT_BRANCH="${CSMON_GIT_BRANCH}" \
    CSMON_COMPOSE_LAN=1 \
    bash "${CSMON_INSTALL_DIR}/scripts/proxmox-starter.sh" "$subcmd"
}

resolve_guest_ip() {
  local ctid="$1"
  if [[ -n "${CSMON_IP:-}" ]]; then
    echo "${CSMON_IP%%/*}"
    return
  fi
  pct exec "$ctid" -- hostname -I 2>/dev/null | awk '{print $1}'
}

cmd_create() {
  require_pve
  load_config

  CSMON_CTID="$(next_free_ctid)"
  if container_exists "$CSMON_CTID"; then
    die "CT ${CSMON_CTID} already exists — set CSMON_CTID or destroy first"
  fi

  local tmpl net0 feat priv_args=()
  tmpl="$(ensure_ubuntu_template)"
  net0="$(net0_spec)"
  feat="$(lxc_features)"

  if [[ "$CSMON_LXC_PRIVILEGED" == "1" ]]; then
    priv_args=(--unprivileged 0)
    log "Creating **privileged** LXC (CSMON_LXC_PRIVILEGED=1)"
  else
    priv_args=(--unprivileged 1)
  fi

  local create_args=(
    create "$CSMON_CTID" "$tmpl"
    --hostname "$CSMON_CT_NAME"
    --cores "$CSMON_CORES"
    --memory "$CSMON_MEMORY"
    --swap "$CSMON_SWAP"
    --rootfs "${CSMON_STORAGE}:${CSMON_DISK}"
    --net0 "$net0"
    --features "$feat"
    --onboot 1
    --start 0
    "${priv_args[@]}"
  )
  if [[ -n "${CSMON_DNS:-}" ]]; then
    create_args+=(--nameserver "$CSMON_DNS")
  fi
  if [[ -n "${CSMON_ROOT_PASSWORD:-}" ]]; then
    create_args+=(--password "$CSMON_ROOT_PASSWORD")
  fi

  log "Creating LXC ${CSMON_CTID} (${CSMON_CT_NAME})…"
  pct "${create_args[@]}"

  write_state
  log "Starting CT ${CSMON_CTID}…"
  pct start "$CSMON_CTID"
  sleep 3
  wait_container_network "$CSMON_CTID"
  guest_bootstrap_packages "$CSMON_CTID"
  guest_ssh_key "$CSMON_CTID"
  guest_run_starter "$CSMON_CTID" install

  local ip
  ip="$(resolve_guest_ip "$CSMON_CTID")"
  log "Done. Container ${CSMON_CTID} (${CSMON_CT_NAME})"
  [[ -n "$ip" ]] && log "App: http://${ip}:3000"
  log "Update from Proxmox host: $(basename "$SCRIPT_PATH") update"
  log "Or on guest: ${CSMON_INSTALL_DIR}/scripts/proxmox-starter.sh update"
}

cmd_update() {
  require_pve
  load_config
  load_state

  container_exists "$CSMON_CTID" || die "CT ${CSMON_CTID} not found"

  local status
  status="$(pct status "$CSMON_CTID" | awk '{print $2}')"
  if [[ "$status" != "running" ]]; then
    log "Starting CT ${CSMON_CTID}…"
    pct start "$CSMON_CTID"
    sleep 3
    wait_container_network "$CSMON_CTID"
  fi

  if pct exec "$CSMON_CTID" -- test -x "${CSMON_INSTALL_DIR}/scripts/proxmox-starter.sh" 2>/dev/null; then
    guest_run_starter_local "$CSMON_CTID" update
  else
    guest_run_starter "$CSMON_CTID" update
  fi

  local ip
  ip="$(resolve_guest_ip "$CSMON_CTID")"
  [[ -n "$ip" ]] && log "App: http://${ip}:3000"
}

cmd_status() {
  require_pve
  load_state
  pct status "$CSMON_CTID" || true
  pct config "$CSMON_CTID" | grep -E '^(hostname|net0|memory|cores):' || true
  if [[ "$(pct status "$CSMON_CTID" 2>/dev/null | awk '{print $2}')" == "running" ]]; then
    pct exec "$CSMON_CTID" -- bash -c "
      if [[ -x ${CSMON_INSTALL_DIR}/scripts/proxmox-starter.sh ]]; then
        ${CSMON_INSTALL_DIR}/scripts/proxmox-starter.sh status
      else
        curl -fsS http://127.0.0.1:3000/api/health && echo || echo 'csmon not healthy'
      fi
    " || true
  fi
}

cmd_logs() {
  require_pve
  load_state
  pct exec "$CSMON_CTID" -- "${CSMON_INSTALL_DIR}/scripts/proxmox-starter.sh" logs
}

cmd_stop() {
  require_pve
  load_state
  pct stop "$CSMON_CTID" || true
}

cmd_start() {
  require_pve
  load_state
  pct start "$CSMON_CTID"
}

cmd_destroy() {
  require_pve
  load_state
  log "Stopping and destroying CT ${CSMON_CTID} (Docker volume csmon-data inside guest will be lost unless you backed up)"
  read -r -p "Type the CTID ${CSMON_CTID} to confirm destroy: " confirm
  [[ "$confirm" == "$CSMON_CTID" ]] || die "aborted"
  pct stop "$CSMON_CTID" 2>/dev/null || true
  pct destroy "$CSMON_CTID"
  rm -f "$STATE_FILE"
  log "Destroyed ${CSMON_CTID}"
}

cmd_app_only() {
  require_pve
  load_config
  load_state
  wait_container_network "$CSMON_CTID"
  guest_run_starter_local "$CSMON_CTID" install 2>/dev/null || guest_run_starter "$CSMON_CTID" install
}

usage() {
  cat <<EOF
Usage: $(basename "$0") <command>

Run on the Proxmox hypervisor as root. Configure /etc/csmon/proxmox-create.env
(see scripts/proxmox-create.env.example): at minimum CSMON_IP and CSMON_GW for static LAN.

Commands:
  create      New Ubuntu 24.04 LXC, network, Docker, clone csmon, start on :3000
  update      git pull + rebuild inside existing container (uses ${STATE_FILE})
  status      Container + csmon health
  logs        Follow csmon logs (guest proxmox-starter)
  start|stop  pct start/stop
  app-only    Re-run guest install on existing running CT (no pct create)
  destroy     Stop and delete container (interactive confirm)

Guest-only install (no Proxmox API): scripts/proxmox-starter.sh

EOF
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    create) cmd_create ;;
    update) cmd_update ;;
    status) cmd_status ;;
    logs) cmd_logs ;;
    start) cmd_start ;;
    stop) cmd_stop ;;
    destroy) cmd_destroy ;;
    app-only) cmd_app_only ;;
    -h | --help | help | "") usage ;;
    *) usage; die "unknown command: $cmd" ;;
  esac
}

main "$@"
