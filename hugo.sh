#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
node ./scripts/sinkron-tanggal-update.mjs
BIND="${HUGO_BIND:-0.0.0.0}"
PORT="${HUGO_PORT:-1313}"
hugo server -D --ignoreCache --disableFastRender --navigateToChanged --noHTTPCache --bind "$BIND" --port "$PORT" --baseURL / --appendPort=false --disableLiveReload=false
