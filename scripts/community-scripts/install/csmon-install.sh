#!/usr/bin/env bash

# Copyright (c) 2021-2026 csmon contributors
# License: MIT (Community Scripts install template)
# Source: https://github.com/womail/csmon

source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

CSMON_REPO="${var_csmon_repo:-https://github.com/womail/csmon.git}"
CSMON_BRANCH="${var_csmon_branch:-main}"
CSMON_DIR="${var_csmon_install_dir:-/opt/csmon}"

msg_info "Installing Docker"
setup_docker
msg_ok "Installed Docker"

msg_info "Installing git"
$STD apt install -y git
msg_ok "Installed git"

if [[ -d "${CSMON_DIR}/.git" ]]; then
  msg_info "Refreshing ${CSMON_DIR}"
  cd "${CSMON_DIR}"
  $STD git fetch origin
  $STD git checkout "${CSMON_BRANCH}"
  $STD git pull --ff-only origin "${CSMON_BRANCH}" || true
else
  msg_info "Cloning csmon (${CSMON_BRANCH})"
  $STD git clone --branch "${CSMON_BRANCH}" --depth 1 "${CSMON_REPO}" "${CSMON_DIR}"
fi
msg_ok "Source ready at ${CSMON_DIR}"

if [[ ! -f "${CSMON_DIR}/.env" && -f "${CSMON_DIR}/.env.example" ]]; then
  msg_info "Creating .env from .env.example"
  cp "${CSMON_DIR}/.env.example" "${CSMON_DIR}/.env"
  msg_warn "Set CSMON_TOKEN in ${CSMON_DIR}/.env if this LAN is not trusted (see SECURITY.md)"
  msg_ok "Created .env"
fi

msg_info "Building and starting csmon (LAN :3000)"
cd "${CSMON_DIR}"
export CSMON_PUBLISH_IP=0.0.0.0
# Clean partial run from a prior failed install (same CTID retry or keep-for-debug).
docker compose down --remove-orphans 2>/dev/null || true
if command -v ss >/dev/null 2>&1 && ss -tln | grep -q ':3000 '; then
  msg_warn "Port 3000 still in use — stopping other csmon containers"
  docker ps -aq --filter 'name=csmon' | xargs -r docker rm -f 2>/dev/null || true
fi
$STD docker compose pull ubuntu
$STD docker compose build --pull
$STD docker compose up -d
msg_ok "Started csmon"

msg_info "Waiting for /api/health"
for _i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    msg_ok "csmon is healthy"
    break
  fi
  sleep 2
done

motd_ssh
customize
cleanup_lxc
