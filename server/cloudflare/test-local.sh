#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export XDG_CONFIG_HOME="${TMPDIR:-/tmp}/skybreak-local-config"
export WRANGLER_LOG_PATH="${TMPDIR:-/tmp}/skybreak-local-logs"
export WRANGLER_SEND_METRICS=false
npm run build --prefix server/cloudflare
LOG=$(mktemp)
node server/cloudflare/local-runtime.mjs > "$LOG" 2>&1 &
RUNTIME=$!
trap 'kill "$RUNTIME" 2>/dev/null || true; wait "$RUNTIME" 2>/dev/null || true; rm -f "$LOG"' EXIT
for i in $(seq 1 60); do
  if grep -q 'http://127.0.0.1:8787' "$LOG"; then break; fi
  if ! kill -0 "$RUNTIME" 2>/dev/null; then cat "$LOG"; exit 1; fi
  sleep 1
done
cat "$LOG"
node server/cloudflare/smoke.mjs
