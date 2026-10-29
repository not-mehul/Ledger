# Roadmap

Suggested next steps for Ledger, roughly in priority order.

## Housekeeping (do first)

- **Rotate the old signing key.** `keystore.jks` was committed in earlier
  history. Treat it as compromised: sign Ledger with a new upload key (see
  README → Releasing). Then remove the keystore and the 24 MB
  `travel_logbook.apk` from history with `git filter-repo` and force-push.
  This also shrinks every clone.
- **Ship through a store track.** Publish an AAB to a Google Play internal
  testing track, or attach signed APKs to GitHub Releases from CI using
  repository secrets for the keystore.
- **Enable R8 for release builds** (`minifyEnabled` + `shrinkResources`) once
  you've smoke-tested a minified build, to cut size and startup time.
- **Raise `targetSdk` to 37** after testing on an Android 17 device.

## Product

- **Custom metrics and weights.** Let users add, rename, re-weight or hide
  metrics. Store definitions in the database (schema v2) and keep the
  ratings keyed by metric id so old entries still score.
- **Richer visits.** Exact dates or date ranges, multiple visits to the same
  city, and a per-city timeline showing how your rating changed.
- **Compare and rank.** Side-by-side comparison of two or three cities, a
  radar chart per entry, and leaderboards per category ("best food",
  "most walkable").
- **Map view.** Plot visited cities on an offline map; autocomplete city and
  country from a bundled place list so names are consistent.
- **Photos.** Attach a few photos per entry with `@capacitor/camera`, stored
  in app storage and included in a zip export.
- **Shareable city card.** Render an entry as an image for social sharing.
- **Undo instead of confirm.** Replace the delete dialog with a toast-style
  "Undo" action.

## Data & sync

- **Automatic backups.** Optional scheduled export, or sync to the user's own
  Google Drive app-data folder; add `dataExtractionRules` to fine-tune
  Android Auto Backup.
- **JSON/CSV export** alongside Markdown for spreadsheets and other tools.
- **Slimmer storage plugin.** `@capacitor-community/sqlite` bundles SQLCipher
  (~2 MB of native code per ABI) that Ledger doesn't use. Either enable
  at-rest encryption to make use of it, or switch to a lighter SQLite plugin
  to roughly halve the APK size.

## Platform & quality

- **End-to-end tests in CI.** Run Playwright against `vite preview` on every
  push, and add an emulator smoke test (for example
  `reactivecircus/android-emulator-runner`) that launches the APK.
- **iOS.** Capacitor makes this mostly a build-configuration task; the export
  and import code paths already use cross-platform plugins.
- **Light theme and Material You.** Follow the system theme and optionally
  pick up dynamic colours.
- **Localisation.** Move UI strings into a message catalogue and format
  dates and numbers with the device locale.
- **UI framework, when it's warranted.** The UI is plain TypeScript with
  template strings, which is fine at this size. If screens like compare, map
  or settings land, adopt a small component framework (Lit, Preact or Svelte)
  rather than growing hand-written DOM code. A fully native Jetpack Compose
  rewrite is the alternative if Ledger stays Android-only and you want native
  widgets.
