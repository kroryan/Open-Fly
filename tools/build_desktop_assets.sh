#!/usr/bin/env bash
# Prepare the complete local Animal Stage runtime, then build its pinned game WASM.
# Generated datasets and executables remain ignored; only scripts/catalogue are pushed.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
OD="${1:-$HERE/../OpenDoctrines}"
REF="${2:-$(tr -d '\r\n' < "$HERE/release/open-doctrines-version")}"
PYTHON="${PYTHON:-python3}"

if [ ! -d "$OD/.git" ]; then
  echo "Open Doctrines checkout not found: $OD" >&2
  exit 1
fi

cd "$HERE"
"$PYTHON" tools/fetch_stage_assets.py --python "$PYTHON"
tools/build_web_agent.sh "$OD" "$REF"
"$PYTHON" tools/pack_web.py --no-gzip web/agent/OpenDoctrinesAgent.data
echo "All seven roster packages and the game runtime are ready for offline desktop builds."
