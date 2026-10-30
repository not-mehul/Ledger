#!/usr/bin/env bash
# Runs on a booted emulator (see .github/workflows/ci.yml):
#   1. the Espresso-Web instrumented tests against the debug build, and
#   2. a launch smoke test of the minified release build.
#
#   scripts/android-emulator-tests.sh <dir with the ledger-apks artifact>
set -euo pipefail

DIR=${1:?usage: android-emulator-tests.sh <apk dir>}
PKG=io.github.notmehul.ledger
APP_APK="$DIR/debug/app-debug.apk"
TEST_APK="$DIR/androidTest/debug/app-debug-androidTest.apk"

# sys.boot_completed can flip before the package and activity services are
# usable, and a fresh image may still restart system_server once.
wait_for_system() {
  for _ in $(seq 1 90); do
    if adb shell pm path android >/dev/null 2>&1 && adb shell am get-current-user >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "System services never became ready." >&2
  return 1
}

is_installed() {
  local out
  out=$(adb shell pm path "$1" 2>/dev/null || true)
  [[ "$out" == *package:* ]]
}

# Installs the APK unless the package is already present; retries on failures.
ensure_installed() {
  local pkg=$1 apk=$2
  for attempt in 1 2 3 4 5; do
    is_installed "$pkg" && return 0
    adb install -r "$apk" || echo "Install attempt $attempt of $pkg failed; retrying…" >&2
    sleep 3
    wait_for_system
  done
  is_installed "$pkg"
}

adb wait-for-device
wait_for_system
sleep 10 # let a post-boot system_server restart happen before installing
wait_for_system

ensure_installed "$PKG" "$APP_APK"
ensure_installed "$PKG.test" "$TEST_APK"
# Re-check right before running: a restart could have dropped an install.
ensure_installed "$PKG" "$APP_APK"

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
