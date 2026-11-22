#!/usr/bin/env bash
# Fails unless VERSION's Android versionCode is higher than 2.1.0's (the last
# version shipped by hand) and than every other v* tag's. Android refuses an
# update with a lower or equal versionCode.
#   scripts/check-version.sh 2.1.1 "$(git ls-remote --tags origin 'v*')"
set -euo pipefail

version="$1"
tags="${2:-}"
floor="2.1.0"

code() {
  local a b c
  IFS=. read -r a b c <<< "$1"
  echo $((a * 10000 + b * 100 + c))
}

if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "::error::'$version' is not a MAJOR.MINOR.PATCH version."
  exit 1
fi

new=$(code "$version")
highest="$floor"
while read -r name; do
  [[ "$name" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || continue
  [[ "$name" == "$version" ]] && continue
  (( $(code "$name") > $(code "$highest") )) && highest="$name"
done < <(sed -E 's#.*refs/tags/v##; s#\^\{\}$##' <<< "$tags")

if (( new <= $(code "$highest") )); then
  echo "::error::v$version (versionCode $new) must be higher than v$highest (versionCode $(code "$highest")), or Android won't install it as an update."
  exit 1
fi
echo "v$version (versionCode $new) is higher than v$highest."
