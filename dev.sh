#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "Memvalidasi content..."
npm run check:content

set -m

TAILWIND_PID=""
HUGO_PID=""

cleanup() {
  trap - EXIT INT TERM

  for pid in "$TAILWIND_PID" "$HUGO_PID"; do
    if [ -n "$pid" ] && kill -0 "-$pid" 2>/dev/null; then
      kill -TERM "-$pid" 2>/dev/null || true
    fi
  done

  sleep 1

  for pid in "$TAILWIND_PID" "$HUGO_PID"; do
    if [ -n "$pid" ] && kill -0 "-$pid" 2>/dev/null; then
      kill -KILL "-$pid" 2>/dev/null || true
    fi
  done

  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "Menjalankan Tailwind watcher..."
npm run dev &
TAILWIND_PID=$!

echo "Menjalankan Hugo server..."
./hugo.sh &
HUGO_PID=$!

wait -n "$TAILWIND_PID" "$HUGO_PID"
exit_code=$?

echo
if [ "$exit_code" -ne 0 ]; then
  echo "Salah satu proses berhenti dengan error (exit code: $exit_code)."
else
  echo "Salah satu proses selesai. Menghentikan proses lainnya."
fi

exit "$exit_code"