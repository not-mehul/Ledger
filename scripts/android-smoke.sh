#!/usr/bin/env bash
# Launches a release APK on a connected device/emulator and checks the
# app starts and renders, catching R8 or packaging problems that unit
# and instrumented (debug) tests can't see.
#
#   scripts/android-smoke.sh path/to/app-release.apk
set -euo pipefail

APK=${1:?usage: android-smoke.sh path/to/app.apk}
PKG=io.github.notmehul.ledger

adb install -r "$APK"
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity"

# The WebView exposes its content to UI Automator once rendered.
for _ in $(seq 1 30); do
  sleep 2
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || continue
  if adb shell cat /sdcard/ui.xml | grep -qi 'save entry'; then
    rendered=1
    break
  fi
done

if adb logcat -d | grep -E "FATAL EXCEPTION|ClassNotFoundException|NoSuchMethodException" ; then
  echo "Release build crashed or hit a missing class (check R8 keep rules)." >&2
  exit 1
fi
if [[ -z "${rendered:-}" ]]; then
  echo "App never rendered its entry form." >&2
  adb logcat -d | tail -200 >&2
  exit 1
fi
adb shell pidof "$PKG" >/dev/null || { echo "App is not running." >&2; exit 1; }
echo "Release smoke test passed."
