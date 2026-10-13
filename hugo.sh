#!/usr/bin/env bash
set -euo pipefail

# Ikat ke localhost secara default. Untuk menguji dari perangkat
# lain di jaringan yang sama: HUGO_BIND=0.0.0.0 ./hugo.sh
BIND="${HUGO_BIND:-127.0.0.1}"

hugo server -D --ignoreCache --disableFastRender --navigateToChanged --noHTTPCache --bind "$BIND"
