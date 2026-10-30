#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
APP_DIR="$(realpath -- "${1:?usage: fix_appimage_runtime.sh APP_DIR OUTPUT_FILE}")"
OUTPUT_FILE="$(realpath -m -- "${2:?usage: fix_appimage_runtime.sh APP_DIR OUTPUT_FILE}")"
CACHE_ROOT="${XDG_CACHE_HOME:-${HOME}/.cache}"
APPIMAGE_PLUGIN="$(find "$CACHE_ROOT/tauri" -maxdepth 1 -type f -name 'linuxdeploy-plugin-appimage*.AppImage' -print -quit)"
if [[ -z "$APPIMAGE_PLUGIN" ]]; then
  echo "could not find Tauri's cached linuxdeploy AppImage plugin in $CACHE_ROOT/tauri" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
cp "$ROOT/tools/appimage-apprun.sh" "$APP_DIR/AppRun"
chmod +x "$APP_DIR/AppRun"
mkdir -p "$(dirname -- "$OUTPUT_FILE")"
(
  cd "$WORK_DIR"
  APPIMAGE_EXTRACT_AND_RUN=1 "$APPIMAGE_PLUGIN" --appdir "$APP_DIR"
)
PACKED_IMAGE="$WORK_DIR/Open_Fly-x86_64.AppImage"
if [[ ! -s "$PACKED_IMAGE" ]]; then
  echo "AppImage repack did not create $PACKED_IMAGE" >&2
  exit 1
fi
mv -f "$PACKED_IMAGE" "$OUTPUT_FILE"
chmod +x "$OUTPUT_FILE"
