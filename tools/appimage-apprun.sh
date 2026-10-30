#!/bin/sh
set -eu

APPDIR="${APPDIR:-$(dirname -- "$0")}"
APPDIR="$(CDPATH= cd -- "$APPDIR" && pwd)"
export APPDIR
unset LD_LIBRARY_PATH
cd "$APPDIR/usr"
export XDG_DATA_DIRS="$APPDIR/usr/share${XDG_DATA_DIRS:+:$XDG_DATA_DIRS}"

exec "$APPDIR/usr/bin/open-fly" "$@"
