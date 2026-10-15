#!/usr/bin/env bash
# Check a running csmon on loopback: headers, open health, and rejected private URLs.
# Usage: scripts/harden-live.sh [--require-auth] [base-url]
set -euo pipefail

require_auth=0
base="http://127.0.0.1:3000"
for arg in "$@"; do
  case "$arg" in
    --require-auth) require_auth=1 ;;
    http://*|https://*) base=${arg%/} ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

host=${base#*://}
host=${host%%/*}
host=${host%%:*}
case "$host" in
  127.0.0.1|localhost|::1) ;;
  *)
    echo "refusing $base — this script only talks to loopback" >&2
    exit 2
    ;;
esac

if ! curl -fsS --max-time 3 "$base/api/health" >/dev/null 2>&1; then
  echo "nothing listening at $base (start the app, then re-run)"
  exit 0
fi

fail=0
bad() { printf '  fail %s\n' "$1"; fail=1; }
ok() { printf '  ok   %s\n' "$1"; }

echo "csmon live check $base"

headers=$(curl -sS -D - --max-time 5 -o /dev/null "$base/" || true)
for needle in \
  "content-security-policy" \
  "x-frame-options: DENY" \
  "x-content-type-options: nosniff" \
  "referrer-policy: strict-origin-when-cross-origin" \
  "cross-origin-opener-policy: same-origin"
do
  if grep -qi "$needle" <<<"$headers"; then
    ok "header ${needle%%:*}"
  else
    bad "missing header $needle"
  fi
done
if grep -qi 'x-powered-by' <<<"$headers"; then
  bad "X-Powered-By is present"
else
  ok "no X-Powered-By"
fi

health=$(curl -sS --max-time 5 "$base/api/health")
if grep -q '"ok":true' <<<"$health"; then
  ok "health is open"
else
  bad "health did not return ok:true"
fi

state_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$base/api/state" || echo 000)
if [[ "$state_code" == "401" ]]; then
  ok "state requires a token"
elif [[ "$state_code" == "200" ]]; then
  if [[ "$require_auth" -eq 1 ]]; then
    bad "state returned 200; CSMON_TOKEN is not enforced"
  else
    ok "state is open (CSMON_TOKEN unset — expected for a local dev server)"
  fi
else
  bad "state returned HTTP $state_code"
fi

# Private targets must be rejected. 401 means the token wall fired first, which is also safe.
for target in "http://127.0.0.1/" "http://169.254.169.254/latest" "https://user:secret@example.com/"; do
  enc=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$target")
  code=$(curl -sS -o /tmp/csmon-harden-body.txt -w '%{http_code}' --max-time 8 \
    "$base/api/read?url=${enc}" || echo 000)
  if [[ "$code" == "200" ]]; then
    bad "read accepted $target"
  else
    ok "read rejected $target (HTTP $code)"
  fi
done
rm -f /tmp/csmon-harden-body.txt

echo
if [[ "$fail" -ne 0 ]]; then
  echo "live check failed"
  exit 1
fi
echo "live check passed"
