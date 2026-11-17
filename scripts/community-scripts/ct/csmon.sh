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

  local install_dir="${var_csmon_install_dir:-/opt/csmon}"
  local branch="${var_csmon_branch:-main}"

  if [[ ! -f "${install_dir}/docker-compose.yml" ]]; then
    msg_error "No ${APP} Installation Found!"
    exit
  fi

  msg_info "Updating ${APP} source"
  cd "${install_dir}"
  git config --global --add safe.directory "${install_dir}" 2>/dev/null || true
  local before after
  before="$(git rev-parse --short HEAD 2>/dev/null || echo none)"
  # Shallow clones cannot fast-forward; FETCH_HEAD is the commit just fetched.
  if ! git fetch --prune --depth 1 origin "+${branch}:refs/remotes/origin/${branch}"; then
    git remote set-url origin "${var_csmon_repo:-https://github.com/womail/csmon.git}"
    git fetch --prune --depth 1 origin "+${branch}:refs/remotes/origin/${branch}"
  fi
  git checkout -f -B "${branch}" FETCH_HEAD
  git reset --hard FETCH_HEAD
  after="$(git rev-parse --short HEAD)"
  msg_ok "Source ${before} → ${after}"

  export CSMON_PUBLISH_IP=0.0.0.0
  export CSMON_GIT_SHA="${after}"
  # Build here (do not re-enter a stale on-disk starter — it still uses git pull --ff-only).
  msg_info "Building ${APP} image"
  $STD docker compose pull ubuntu || true
  if ! $STD docker compose build --pull --build-arg "CSMON_GIT_SHA=${after}"; then
    msg_warn "Build failed — stopping the running app to free memory and retrying"
    docker compose down --remove-orphans 2>/dev/null || true
    $STD docker compose pull ubuntu || true
    $STD docker compose build --pull --build-arg "CSMON_GIT_SHA=${after}"
  fi
  msg_ok "Image built"

  msg_info "Starting ${APP}"
  if command -v ss >/dev/null 2>&1 && ss -tln | grep -q ':3000 '; then
    docker ps -aq --filter 'name=csmon' | xargs -r docker rm -f 2>/dev/null || true
  fi
  docker compose up -d --force-recreate --remove-orphans
  msg_ok "Updated ${APP}"

  msg_info "Waiting for /api/health"
  local healthy=0
  for _i in $(seq 1 60); do
    if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
      healthy=1
      break
    fi
    sleep 2
  done
  if [[ "$healthy" -eq 1 ]]; then
    msg_ok "Health check passed $(curl -fsS http://127.0.0.1:3000/api/version 2>/dev/null || true)"
  else
    docker compose logs --tail=80 csmon || true
    msg_error "App did not become healthy — see logs above"
    exit
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
