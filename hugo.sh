#!/usr/bin/env bash
set -euo pipefail

hugo server -D --ignoreCache --disableFastRender --navigateToChanged --noHTTPCache --bind 0.0.0.0
