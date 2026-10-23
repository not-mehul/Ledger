#!/usr/bin/env bash
# Reproduces the contents of decompiled/ from travel_logbook.apk.
#
# Usage: tools/decompile.sh [path/to/apk] [work-dir]
#
# Requires: Java 11+, curl, unzip, and Node (for `npx prettier`).
# The full jadx output (all third-party Capacitor/AndroidX/Kotlin classes)
# is left in the work dir; only the app-specific files are copied into the repo.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APK="${1:-$REPO/travel_logbook.apk}"
WORK="${2:-$(mktemp -d)}"
JADX_VERSION="1.5.1"

if [ ! -x "$WORK/jadx/bin/jadx" ]; then
  curl -sSL -o "$WORK/jadx.zip" \
    "https://github.com/skylot/jadx/releases/download/v$JADX_VERSION/jadx-$JADX_VERSION.zip"
  unzip -q "$WORK/jadx.zip" -d "$WORK/jadx"
fi

"$WORK/jadx/bin/jadx" -d "$WORK/out" --show-bad-code "$APK" || true  # jadx exits non-zero on minor library decode errors

OUT="$WORK/out"
DEST="$REPO/decompiled"
mkdir -p "$DEST/android/res/xml" "$DEST/web/public/assets" "$DEST/web-pretty"

cp "$OUT/resources/AndroidManifest.xml" "$DEST/android/"
cp "$OUT/sources/com/travellogbook/app/MainActivity.java" "$DEST/android/"
cp "$OUT/resources/res/xml/file_paths.xml" "$OUT/resources/res/xml/config.xml" "$DEST/android/res/xml/"

cp "$OUT/resources/assets/capacitor.config.json" "$OUT/resources/assets/capacitor.plugins.json" "$DEST/web/"
cp "$OUT/resources/assets/public/"*.html "$OUT/resources/assets/public/"*.js "$DEST/web/public/"
cp "$OUT/resources/assets/public/assets/"*.js "$DEST/web/public/assets/"

for f in "$DEST/web/public/assets/"*.js; do
  npx --yes prettier@3 --parser babel "$f" > "$DEST/web-pretty/$(basename "$f")"
done

echo "Full jadx output: $OUT"
