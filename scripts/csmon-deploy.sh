#!/usr/bin/env bash
# csmon-deploy — production / pre-production slot manager (Docker or Node).
# Usage: scripts/csmon-deploy.sh [command]   (no args → interactive menu)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/csmon-deploy-lib.sh
source "${ROOT}/scripts/lib/csmon-deploy-lib.sh"

usage() {
  cat <<EOF
Usage: scripts/csmon-deploy.sh <command> [args]

Commands:
  init                      Initialize state under .csmon-deploy/
  status                    Show slots, ports, paths, retention summary
  retention                 Print detailed retain / promote policy
  runtime [docker|node]     Set or show runtime mode
  pull-build [preprod]      Git pull + build pre-production (default) or production
  snapshot-preprod          Refresh pre-prod DB snapshot from production shared data
  start <production|preprod>
  stop <production|preprod>
  copy-to <name>            Copy production code + data snapshot to named slot
  promote                   Promote pre-prod code → production; archive old prod code
  rollback                  Restore previous production code (toggle back)
  menu                      Interactive menu (default)

Environment:
  CSMON_DEPLOY_STATE_ROOT   Override state directory (default: <repo>/.csmon-deploy)

Ports (from deploy/manifest.sh):
  production      ${CSMON_PORT_PRODUCTION} on ${CSMON_BIND_HOST}
  pre-production  ${CSMON_PORT_PREPRODUCTION} on ${CSMON_BIND_HOST}

EOF
}

csmon_menu() {
  while true; do
    csmon_print_status
    echo " 1) Pull + build pre-production"
    echo " 2) Refresh pre-prod data snapshot from production"
    echo " 3) Start pre-production (test on port $(csmon_slot_port preproduction))"
    echo " 4) Stop pre-production"
    echo " 5) Promote pre-production → production"
    echo " 6) Rollback production code (previous version)"
    echo " 7) Start production (port $(csmon_slot_port production))"
    echo " 8) Stop production"
    echo " 9) Copy production → named slot"
    echo "10) Set runtime (docker / node)"
    echo "11) Retention reference"
    echo " 0) Exit"
    echo
    read -r -p "Choice: " choice
    case "$choice" in
      1) csmon_pull_build_slot preproduction ;;
      2) csmon_refresh_preprod_snapshot ;;
      3) csmon_slot_start preproduction ;;
      4) csmon_slot_stop preproduction ;;
      5)
        read -r -p "Promote pre-prod code to production? Live DB and .env stay put [y/N]: " confirm
        [[ "$confirm" =~ ^[yY] ]] && csmon_promote_preprod
        ;;
      6)
        read -r -p "Rollback production to archived code? [y/N]: " confirm
        [[ "$confirm" =~ ^[yY] ]] && csmon_rollback_production
        ;;
      7) csmon_slot_start production ;;
      8) csmon_slot_stop production ;;
      9)
        read -r -p "Slot name (alphanumeric): " sname
        [[ -n "$sname" ]] && csmon_copy_production_to_named "$sname"
        ;;
      10)
        read -r -p "Runtime docker or node: " rt
        case "$rt" in
          docker | node)
            csmon_state_load
            CSMON_RUNTIME="$rt"
            csmon_state_save
            csmon_ok "Runtime set to ${rt}"
            ;;
          *) csmon_warn "Invalid runtime" ;;
        esac
        ;;
      11) csmon_print_retention_doc ;;
      0 | q | Q) exit 0 ;;
      *) csmon_warn "Unknown choice" ;;
    esac
    echo
    read -r -p "Press Enter to continue…" _
  done
}

cmd="${1:-menu}"

case "$cmd" in
  -h | --help | help) usage ;;
  init)
    csmon_init_if_needed
    csmon_sync_shared_env_from_production
    csmon_sync_shared_data_from_production
    csmon_ok "Initialized ${CSMON_DEPLOY_STATE_ROOT}"
    ;;
  status) csmon_print_status ;;
  retention) csmon_print_retention_doc ;;
  runtime)
    csmon_init_if_needed
    csmon_state_load
    if [[ -n "${2:-}" ]]; then
      case "$2" in
        docker | node)
          CSMON_RUNTIME="$2"
          csmon_state_save
          csmon_ok "Runtime set to $2"
          ;;
        *) csmon_die "runtime must be docker or node" ;;
      esac
    else
      echo "$(csmon_runtime_resolve)"
    fi
    ;;
  pull-build)
    slot="${2:-preproduction}"
    csmon_pull_build_slot "$slot"
    ;;
  snapshot-preprod) csmon_refresh_preprod_snapshot ;;
  start) csmon_slot_start "${2:?usage: start production|preprod}" ;;
  stop) csmon_slot_stop "${2:?usage: stop production|preprod}" ;;
  copy-to) csmon_copy_production_to_named "${2:?usage: copy-to <name>}" ;;
  promote) csmon_promote_preprod ;;
  rollback) csmon_rollback_production ;;
  menu | "") csmon_menu ;;
  *)
    csmon_err "Unknown command: $cmd"
    usage
    exit 1
    ;;
esac
