#!/usr/bin/env bash
# Build the Open Doctrines game module the browser fly plays through.
#
#   tools/build_web_agent.sh [path/to/Open-Doctrines] [git ref]
#
# The module is Open Doctrines' own OpenDoctrinesAgent target (src/web/AgentWeb.cpp
# over the agent session in src/Game_Agent.cpp), so a new version of the game is
# a new build of this, nothing else: pass the tag or commit to build from and
# web/agent/ is replaced, with the ref it came from in web/agent/VERSION.
# Needs Emscripten (emcmake) on PATH.
set -euo pipefail

OD="${1:-$(cd "$(dirname "$0")/../.." && pwd)/OpenDoctrines}"
REF="${2:-}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Some packaged Emscripten distributions ship wasm-opt beside its shared
# Binaryen library but omit that directory from the dynamic loader path.
for libdir in "${EM_BINARYEN_ROOT:-}/lib/x86_64-linux-gnu" "${EM_BINARYEN_ROOT:-}/lib"; do
  if [ -n "${EM_BINARYEN_ROOT:-}" ] && [ -f "$libdir/libbinaryen.so" ]; then
    export LD_LIBRARY_PATH="$libdir${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
    break
  fi
done

if [ -n "$REF" ]; then
  git -C "$OD" worktree add --detach "$WORK/od" "$REF" >/dev/null
  SRC="$WORK/od"
  trap 'git -C "$OD" worktree remove --force "$WORK/od" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
else
  SRC="$OD"
fi

# ── PATCHES THE RELEASED GAME DOES NOT CARRY YET ──
#
# Applied to the throwaway copy only, never to the Open Doctrines checkout.
# Each one is skipped when that build already has it, so this keeps working
# after a patch lands upstream. opendoctrines-agent-research.patch: research is
# progressed for every country except the player's -- and the fly IS the player,
# so it never researched at all while every country around it did.
if [ -n "$REF" ]; then
  PATCH_TREE="$SRC"
else
  # Without a ref we build the checkout in place, which we must not patch.
  git -C "$OD" worktree add --detach "$WORK/od" HEAD >/dev/null
  SRC="$WORK/od"
  PATCH_TREE="$SRC"
  trap 'git -C "$OD" worktree remove --force "$WORK/od" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
fi
APPLIED=""
# The stage patch adds the multi-seat API and includes the player research fix.
# Apply it before the narrower patches so their overlap is detected cleanly.
STAGE_PATCH="$HERE/patches/opendoctrines-agent-stage.patch"
if [ -f "$STAGE_PATCH" ] && ! grep -q "od_agent_stage_begin" "$SRC/src/web/AgentWeb.cpp"; then
  if ! git -C "$PATCH_TREE" apply --unidiff-zero --check "$STAGE_PATCH"; then
    echo "Open Doctrines ref $REF cannot accept the pinned stage patch" >&2
    exit 1
  fi
  git -C "$PATCH_TREE" apply --unidiff-zero "$STAGE_PATCH"
  APPLIED="+stage"
  echo "applied opendoctrines-agent-stage.patch"
fi
for p in "$HERE"/patches/opendoctrines-agent-*.patch; do
  [ -f "$p" ] || continue
  [ "$(basename "$p")" = "opendoctrines-agent-stage.patch" ] && continue
  if git -C "$PATCH_TREE" apply --unidiff-zero --check "$p" 2>/dev/null; then
    git -C "$PATCH_TREE" apply --unidiff-zero "$p"
    APPLIED="$APPLIED+$(basename "$p" .patch | sed 's/^opendoctrines-agent-//')"
    echo "applied $(basename "$p")"
  else
    echo "skipped $(basename "$p") (already in this build, or it no longer applies)"
  fi
done

JOBS="${BUILD_JOBS:-$(sysctl -n hw.ncpu 2>/dev/null || nproc)}"
CMETA=("-DOD_ENABLE_SHAPING=OFF")
if [ -n "${RAYLIB_SOURCE_DIR:-}" ]; then
  CMETA+=("-DFETCHCONTENT_SOURCE_DIR_RAYLIB=$RAYLIB_SOURCE_DIR")
fi
emcmake cmake -S "$SRC" -B "$WORK/build" -DCMAKE_BUILD_TYPE=Release "${CMETA[@]}"
cmake --build "$WORK/build" --target OpenDoctrinesAgent -j"$JOBS"

mkdir -p "$HERE/web/agent"
cp "$WORK/build/OpenDoctrinesAgent.mjs" "$WORK/build/OpenDoctrinesAgent.wasm" "$WORK/build/OpenDoctrinesAgent.data" "$HERE/web/agent/"
# The ref, plus any patch this build carries, so the page can say what it runs.
echo "$(git -C "$SRC" describe --tags --always)$APPLIED" > "$HERE/web/agent/VERSION"
echo "web/agent: OpenDoctrinesAgent from $(cat "$HERE/web/agent/VERSION")"
