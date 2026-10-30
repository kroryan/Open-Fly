#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
TARGET="${1:-all}"
case "$TARGET" in linux|windows|all) ;; *) echo "usage: $0 [linux|windows|all]" >&2; exit 2 ;; esac
export OPEN_FLY_BUILD_PROFILE=public

build_linux() {
  npm --prefix "$ROOT/desktop" run build:linux
  local target="$ROOT/desktop/src-tauri/target/release"
  "$ROOT/tools/fix_appimage_runtime.sh" "$target/bundle/appimage/Open Fly.AppDir" "$target/bundle/appimage/Open Fly_1.3.0_amd64.AppImage"
  local out="$ROOT/dist/desktop/public/linux"
  mkdir -p "$out"
  cp "$target/open-fly" "$out/open-fly"
  cp "$target/bundle/deb/Open Fly_1.3.0_amd64.deb" "$out/"
  cp "$target/bundle/appimage/Open Fly_1.3.0_amd64.AppImage" "$out/"
  chmod +x "$out/open-fly" "$out/Open Fly_1.3.0_amd64.AppImage"
}

build_windows() {
  if ! command -v llvm-rc >/dev/null 2>&1; then
    for llvm_bin in /usr/lib/llvm-*/bin; do
      if [[ -x "$llvm_bin/llvm-rc" ]]; then export PATH="$llvm_bin:$PATH"; break; fi
    done
  fi
  local nsis_root="/tmp/open-fly-tools/nsis/root"
  if [[ -z "${NSISDIR:-}" && -d "$nsis_root/usr/share/nsis/Stubs" ]]; then
    export NSISDIR="$nsis_root/usr/share/nsis"
    export PATH="$nsis_root/usr/bin:$PATH"
  fi
  local target="$ROOT/desktop/src-tauri/target/x86_64-pc-windows-msvc/release"
  local out="$ROOT/dist/desktop/public/windows"
  npm --prefix "$ROOT/desktop" run build:windows || true
  local installer="$target/bundle/nsis/Open Fly_1.3.0_x64-setup.exe"
  if [[ ! -s "$installer" && -f "$target/nsis/x64/installer.nsi" ]]; then
    local makensis="$(command -v makensis || true)"
    if [[ -z "$makensis" && -n "${NSISDIR:-}" && -x "${NSISDIR%/}/../bin/makensis" ]]; then
      makensis="${NSISDIR%/}/../bin/makensis"
    fi
    if [[ -z "$makensis" && -x "$nsis_root/usr/bin/makensis" ]]; then
      makensis="$nsis_root/usr/bin/makensis"
      export NSISDIR="$nsis_root/usr/share/nsis"
    fi
    if [[ -n "$makensis" ]]; then
      mkdir -p "$target/bundle/nsis"
      (cd "$target/nsis/x64" && "$makensis" installer.nsi)
      cp "$target/nsis/x64/nsis-output.exe" "$installer"
    fi
  fi
  mkdir -p "$out"
  cp "$target/open-fly.exe" "$out/"
  find "$target/bundle/nsis" -maxdepth 1 -type f -name '*.exe' -exec cp {} "$out/" \;
  if ! find "$out" -maxdepth 1 -type f -name '*setup.exe' -print -quit | grep -q .; then
    echo "NSIS installer was not produced" >&2
    exit 1
  fi
}

if [[ "$TARGET" == linux || "$TARGET" == all ]]; then build_linux; fi
if [[ "$TARGET" == windows || "$TARGET" == all ]]; then build_windows; fi

# Upload this directory as the site's static output alongside the desktop
# builds. Its /brains/<revision>/ tree is the CORS-enabled download origin.
python3 "$ROOT/tools/stage_web.py" --out "$ROOT/dist/public-site"
for source in "$ROOT"/dist/brain-host/*; do
  [[ -d "$source" ]] || continue
  revision="${source##*/}"
  mkdir -p "$ROOT/dist/public-site/brains/$revision"
  cp -a "$source/." "$ROOT/dist/public-site/brains/$revision/"
done
cat > "$ROOT/dist/public-site/_headers" <<'HEADERS'
/brains/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Cache-Control: public, max-age=31536000, immutable
HEADERS
