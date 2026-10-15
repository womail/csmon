#!/usr/bin/env bash
_CS_DEFAULT_URL="https://raw.githubusercontent.com/womail/csmon/main/scripts/community-scripts"
_cs_boot="${COMMUNITY_SCRIPTS_CORE_DIR:-$(dirname "${BASH_SOURCE[0]}")/../../core}/core/build.func"
source "$_cs_boot" 2>/dev/null || source <(curl -fsSL "${COMMUNITY_SCRIPTS_CORE_URL:-https://raw.githubusercontent.com/community-scripts/core/main}/core/build.func")
# Copyright (c) 2021-2026 csmon contributors
# License: MIT (Community Scripts CT template)
# Source: https://github.com/womail/csmon

APP="csmon"
var_tags="${var_tags:-monitor;security;rss}"
var_cpu="${var_cpu:-4}"
var_ram="${var_ram:-4096}"
var_disk="${var_disk:-32}"
var_os="${var_os:-debian}"
var_version="${var_version:-13}"
var_unprivileged="${var_unprivileged:-1}"
var_arm64="${var_arm64:-yes}"
var_fuse="${var_fuse:-yes}"

export var_csmon_repo="${var_csmon_repo:-https://github.com/womail/csmon.git}"
export var_csmon_branch="${var_csmon_branch:-main}"
export var_csmon_install_dir="${var_csmon_install_dir:-/opt/csmon}"

header_info "$APP"
variables
color
catch_errors

function update_script() {
  header_info
  check_container_storage
  check_container_resources

  if [[ ! -f "${var_csmon_install_dir}/docker-compose.yml" ]]; then
    msg_error "No ${APP} Installation Found!"
    exit
  fi

  msg_info "Updating ${APP} (git + Docker rebuild)"
  cd "${var_csmon_install_dir}"
  $STD git fetch origin
  $STD git pull --ff-only origin "${var_csmon_branch}"
  $STD docker compose -f docker-compose.yml -f docker-compose.lan.yml pull ubuntu
  $STD docker compose -f docker-compose.yml -f docker-compose.lan.yml build --pull
  $STD docker compose -f docker-compose.yml -f docker-compose.lan.yml up -d
  msg_ok "Updated ${APP}"

  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
    msg_ok "Health check passed"
  else
    msg_warn "App not healthy yet — check: docker compose logs csmon"
  fi
  exit
}

start
build_container
description

msg_ok "Completed successfully!\n"
echo -e "${CREATING}${GN}${APP} setup has been successfully initialized!${CL}"
echo -e "${INFO}${YW}Access it using the following URL:${CL}"
echo -e "${GATEWAY}${BGN}http://${IP}:3000${CL}"
echo -e "${TAB}${TAB}${GN}Update:${CL} re-run this script and choose update, or inside the CT: ${GN}update${CL}"
