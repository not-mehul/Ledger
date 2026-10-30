#!/usr/bin/env bash
# Runs on a booted emulator (see .github/workflows/ci.yml):
#   1. the Espresso-Web instrumented tests against the debug build, and
#   2. a launch smoke test of the minified release build.
#
#   scripts/android-emulator-tests.sh <dir with the ledger-apks artifact>
set -euo pipefail

DIR=${1:?usage: android-emulator-tests.sh <apk dir>}
PKG=io.github.notmehul.ledger

# sys.boot_completed can flip before the package manager accepts installs.
wait_for_package_manager() {
  for _ in $(seq 1 60); do
    adb shell pm path android >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "Package manager never became ready." >&2
  return 1
}

install() {
  for attempt in 1 2 3 4 5; do
    adb install -r "$1" && return 0
    echo "Install attempt $attempt failed; retrying…" >&2
    sleep 5
    wait_for_package_manager
  done
  return 1
}

adb wait-for-device
wait_for_package_manager
install "$DIR/debug/app-debug.apk"
install "$DIR/androidTest/debug/app-debug-androidTest.apk"
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
adb uninstall "$PKG.test" >/dev/null 2>&1 || true
"$(dirname "$0")/android-smoke.sh" "$DIR/release/app-release-smoke.apk"
