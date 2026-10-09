#!/usr/bin/env bash
# Re-capture help screenshots with the dev server running (pnpm dev).
# Uses Cursor browser automation or manual exports into public/help/screenshots/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/public/help/screenshots"
mkdir -p "$DEST"
echo "Place PNG captures in: $DEST"
echo "Expected files: home-dashboard, brief-board, pulse-trends, sources-layers,"
echo "reader-in-place, patch-kev-desk.png"
echo "Then commit public/help/screenshots/*.png with help doc changes."
