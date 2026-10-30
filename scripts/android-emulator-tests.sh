#!/usr/bin/env bash
# Runs on a booted emulator (see .github/workflows/ci.yml):
#   1. the Espresso-Web instrumented tests against the debug build, and
#   2. a launch smoke test of the minified release build.
#
#   scripts/android-emulator-tests.sh <dir with the ledger-apks artifact>
set -euo pipefail

DIR=${1:?usage: android-emulator-tests.sh <apk dir>}
PKG=io.github.notmehul.ledger

adb install -r "$DIR/debug/app-debug.apk"
adb install -r "$DIR/androidTest/debug/app-debug-androidTest.apk"
OUT=$(adb shell am instrument -w -r "$PKG.test/androidx.test.runner.AndroidJUnitRunner")
echo "$OUT"
# Raw output reports status 0 per passing test, -2 per failure and -1 per error.
passed=$(grep -c "INSTRUMENTATION_STATUS_CODE: 0" <<<"$OUT" || true)
if grep -qE "INSTRUMENTATION_STATUS_CODE: -[12]|INSTRUMENTATION_FAILED|Process crashed" <<<"$OUT" \
  || ! grep -q "INSTRUMENTATION_CODE: -1" <<<"$OUT" || [[ "$passed" -lt 1 ]]; then
  echo "Instrumented tests failed." >&2
  exit 1
fi
echo "Instrumented tests passed ($passed)."

# The release build has a different signature; replace the debug install.
adb uninstall "$PKG"
"$(dirname "$0")/android-smoke.sh" "$DIR/release/app-release-smoke.apk"
