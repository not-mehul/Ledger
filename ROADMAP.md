# Roadmap

## Done in 2.1

- Release builds shrunk with R8; targets Android 17 (API 37). The full
  instrumented and release smoke tests pass on an API 36 emulator in CI;
  on API 37 the app launches and passes its first test before the
  emulator's own system process crashes (see below).
- User-defined metrics and categories.
- Offline city autocomplete and a map of visited places.
- Photos on entries and shareable city cards.
- Automatic backups, Android Auto Backup rules, CSV/JSON/zip export.
- APK size cut from 12.3 MB to 1.7 MB by replacing the SQLCipher-based
  SQLite plugin with a JSON document store.
- Playwright and emulator tests in CI, an iOS app, a light theme and four
  languages.
- UI rebuilt on Svelte 5.

## Still to do

- **Make the API 37 emulator job blocking again.** Current API 37 images
  crash `system_server` in its task-snapshot thread
  (`Assertion failed: !rcEnc->featureInfo()->hasReadColorBufferDma`), so
  that CI job is marked `experimental`. Flip it back once a fixed system
  image ships, and give Ledger a pass on a physical Android 17 device.

- **Rotate the old signing key and clean history.** `keystore.jks` and a
  24 MB APK are still in early commits. Sign Ledger with a new key and
  remove them with `git filter-repo`.
- **Ship through a store track.** Google Play internal testing and
  TestFlight, with signing secrets in CI.
- **Richer visits.** Exact dates or ranges, repeat visits to a city, and a
  timeline of how a rating changed.
- **Compare and rank.** Side-by-side comparison, per-category leaderboards
  and charts.
- **Background backups.** Today automatic backups run when the app opens;
  a WorkManager / BGTaskScheduler job could run them without opening it.
- **Cloud sync.** Optional sync through the user's own storage (Google
  Drive app folder, iCloud Drive), which needs an OAuth client per store.
- **More languages.** Add a file under `src/i18n/`; the typecheck lists
  any missing keys.
- **iOS polish.** iOS has no hardware back button, and the
  `Documents/Ledger` folder appears under *On My iPhone → Ledger* in Files.
  A share extension for importing could make moving data in easier.
