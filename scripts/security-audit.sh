#!/usr/bin/env bash
# Static checks for the csmon threat model. No network. Exit 1 on a failed check.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
# The interactive shell aliases grep to ripgrep, which treats "(" as regex.
GREP=/usr/bin/grep
if [[ ! -x "$GREP" ]]; then
  echo "need /usr/bin/grep" >&2
  exit 1
fi

fail=0
warn=0

ok() { printf '  ok   %s\n' "$1"; }
bad() { printf '  fail %s\n' "$1"; fail=1; }
note() { printf '  warn %s\n' "$1"; warn=$((warn + 1)); }

echo "csmon security audit"

if [[ -f next.config.ts ]] \
  && "$GREP" -q 'poweredByHeader: false' next.config.ts \
  && "$GREP" -q 'X-Frame-Options' next.config.ts \
  && "$GREP" -q 'nosniff' next.config.ts \
  && "$GREP" -q 'frame-ancestors' proxy.ts \
  && "$GREP" -q 'strict-dynamic' proxy.ts \
  && "$GREP" -q "nonce-" proxy.ts
then
  ok "security headers and CSP nonce"
else
  bad "next.config.ts or proxy.ts is missing a header, poweredByHeader: false, or the CSP nonce"
fi

if "$GREP" -q 'HttpOnly' lib/guard.ts && "$GREP" -q 'SameSite=Strict' lib/guard.ts && "$GREP" -q 'timingSafeEqual' lib/guard.ts; then
  ok "session cookie flags and constant-time token compare"
else
  bad "lib/guard.ts lost HttpOnly, SameSite=Strict, or timingSafeEqual"
fi

if "$GREP" -q 'metadata.google.internal' lib/public-url.ts \
  && "$GREP" -q '169 && b === 254' lib/public-url.ts \
  && "$GREP" -q 'redirect: "manual"' lib/safe-url.ts
then
  ok "outbound policy blocks link-local metadata and re-checks redirects"
else
  bad "lib/public-url.ts or lib/safe-url.ts dropped a block or follows redirects automatically"
fi

# Handlers that must call gate(). health and session are the open exceptions.
while IFS= read -r route; do
  rel=${route#"$root"/}
  handlers=$("$GREP" -Ec 'export (async )?function (GET|POST|PUT|PATCH|DELETE)' "$route" || true)
  gates=$("$GREP" -c 'gate(' "$route" || true)
  case "$rel" in
    app/api/health/route.ts|app/api/session/route.ts)
      ok "$rel stays open ($handlers handler(s))"
      ;;
    app/api/version/route.ts)
      if [[ "$gates" -lt "$handlers" ]]; then
        note "$rel has no gate(); commit and version are visible without CSMON_TOKEN"
      else
        ok "$rel is gated"
      fi
      ;;
    *)
      if [[ "$handlers" -eq 0 ]]; then
        note "$rel has no exported handler"
      elif [[ "$gates" -lt "$handlers" ]]; then
        bad "$rel has $handlers handler(s) and $gates gate() call(s)"
      else
        ok "$rel gated ($handlers)"
      fi
      ;;
  esac
done < <(find app/api -name route.ts | sort)

# Raw fetch in server code. Browser calls and the outbound helper itself are fine.
allow_fetch=(
  lib/safe-url.ts
  lib/api-client.ts
  lib/geo-countries-cache.ts
)
warn_fetch=(
  app/api/update/route.ts
  lib/update-manifest.ts
)
while IFS= read -r file; do
  rel=${file#"$root"/}
  skip=0
  for allowed in "${allow_fetch[@]}"; do
    [[ "$rel" == "$allowed" ]] && skip=1
  done
  [[ "$skip" -eq 1 ]] && continue
  for warned in "${warn_fetch[@]}"; do
    if [[ "$rel" == "$warned" ]]; then
      note "$rel calls fetch() directly; send this through fetchOutbound if you touch it"
      skip=1
    fi
  done
  [[ "$skip" -eq 1 ]] && continue
  bad "$rel calls fetch() outside fetchOutbound"
done < <("$GREP" -REl --include='*.ts' --include='*.tsx' 'fetch[(]' app/api lib || true)

if "$GREP" -q 'host_ip: ${CSMON_PUBLISH_IP:-127.0.0.1}' docker-compose.yml \
  && "$GREP" -q 'no-new-privileges:true' docker-compose.yml \
  && "$GREP" -q 'cap_drop:' docker-compose.yml \
  && "$GREP" -q 'user: "1001:1001"' docker-compose.yml
then
  ok "compose defaults to loopback, drops capabilities, runs as uid 1001"
else
  bad "docker-compose.yml lost the loopback default, cap_drop, or uid 1001"
fi

if "$GREP" -q '^USER nextjs$' Dockerfile && "$GREP" -q 'uid 1001' Dockerfile; then
  ok "image runs as uid 1001"
else
  bad "Dockerfile is missing USER nextjs or uid 1001"
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  tracked=$(git ls-files '*.env' '.env' '.env.local' '.env.production' || true)
  if [[ -n "$tracked" ]]; then
    bad "tracked env file: $tracked"
  else
    ok "no tracked .env file"
  fi
fi

if "$GREP" -q 'The API never applies updates' app/api/update/route.ts \
  || "$GREP" -q 'never applies updates' app/api/update/route.ts
then
  ok "update route stays check-only"
else
  bad "app/api/update/route.ts no longer states that the API does not apply updates"
fi

echo
if [[ "$fail" -ne 0 ]]; then
  echo "audit failed"
  exit 1
fi
if [[ "$warn" -ne 0 ]]; then
  echo "audit passed with $warn warning(s)"
else
  echo "audit passed"
fi
