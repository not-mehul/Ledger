# Ledger — Travel Logbook

Source recovered from `travel_logbook.apk` (package `com.travellogbook.app`, v1.0). The app is a
Capacitor 7 hybrid app for rating cities on 12 weighted metrics.

**→ The audit is in [AUDIT.md](AUDIT.md).** It covers bugs, security, dead code, improvements and future features.

## What's here

```
travel_logbook.apk         the original APK, untouched
AUDIT.md                   full audit report
source/                    readable, rebuildable reconstruction of the app (Vite + Capacitor 7)
  index.html               markup + inline CSS (verbatim from the APK)
  src/main.js              UI: form, score ring, logbook list, edit/delete, tabs, toast
  src/metrics.js           the 12 metrics, weights and category groupings
  src/storage.js           SQLite (native) / localStorage (web) persistence
  src/export.js            Markdown export
  src/datepicker.js        month picker
  src/dates.js             date helpers
decompiled/                files exactly as extracted from the APK
  android/                 AndroidManifest.xml, MainActivity.java, res/xml, icon + splash
  web/                     assets/public as shipped (minified bundles) + capacitor config
  web-pretty/              the same bundles run through Prettier (for line references)
tools/decompile.sh         regenerates decompiled/ from the APK (jadx 1.5.1 + prettier)
tools/equivalence-check.mjs Playwright scenario used to prove source/ behaves like the APK
```

### What the APK contained

Almost all of the APK is third-party code: Capacitor, AndroidX, Kotlin and SQLCipher. The only native app class is
an empty `MainActivity extends BridgeActivity`. **All app logic is the web bundle** in `assets/public`. That is
roughly 600 lines of vanilla JS inside a 42 KB Vite chunk, plus a 1,200-line `index.html`. Variable names were
minified away, so `source/` restores readable names and splits the code into modules. The logic, strings, markup
and CSS are unchanged; see the [name map](#name-map).

The full jadx output (about 3,800 library classes) isn't committed. Run `tools/decompile.sh` to regenerate it.

## Rebuilding

```bash
cd source
npm install
npm run dev              # runs in the browser (data in localStorage)
npm run build            # -> dist/

# Android: the original Gradle project isn't recoverable from the APK, so regenerate it
npx cap add android      # Capacitor 7 template: minSdk 23, compile/target 35 — same as the APK
npx cap sync android
npx cap open android     # build, then sign (the original APK was unsigned)
```

The original manifest also declared `MANAGE_EXTERNAL_STORAGE`. It isn't re-added here on purpose; see AUDIT.md
**S1/B5**. Commit the generated `android/` directory this time.

## How the reconstruction was verified

`tools/equivalence-check.mjs` drives the same scripted session against the original APK bundle and the rebuilt
`source/`, with a frozen clock. The session seeds data, adds, edits, deletes, sorts, searches, exports and reloads.
It records 29 snapshots: rendered HTML, toasts, score ring, localStorage contents and the exported Markdown.
**Both traces were byte-identical in UTC and in Asia/Kolkata, with no page errors.**

```bash
npm install --no-save playwright            # in the repo root
(cd source && npm run build)
python3 -m http.server 8701 --directory decompiled/web/public &
python3 -m http.server 8702 --directory source/dist &
node tools/equivalence-check.mjs http://127.0.0.1:8701/ orig.json
node tools/equivalence-check.mjs http://127.0.0.1:8702/ rebuilt.json
diff orig.json rebuilt.json && echo identical
```

This also works as a regression baseline: once you start fixing the audit findings, the diff shows exactly which
behaviour changed.

## Name map

Minified name in `decompiled/web-pretty/index-DJyC1WZe.js` → name in `source/src/`.

| Minified | Reconstructed | | Minified | Reconstructed |
|---|---|---|---|---|
| `L` | `METRICS` | | `tt` | `buildSliders` |
| `$e` | `CATEGORY_CONTAINERS` | | `se` | `updateMetric` |
| `ge` | `METRIC_GROUPS` | | `be` | `paintSliderTrack` |
| `ke` | `TOTAL_WEIGHT` | | `Ee` | `readRatings` |
| `j` | `Capacitor` | | `Pe` | `computeScore` |
| `Me` / `Ue` | `CapacitorSQLite` / `SQLiteConnection` | | `rt` | `updateScore` |
| `R` / `U` / `M` | `Filesystem` / `Directory` / `Encoding` | | `nt` | `handleSave` |
| `K` / `Fe` / `re` | `DB_NAME` / `DB_VERSION` / `LOCAL_STORAGE_KEY` | | `Le` | `clearForm` |
| `W` | `isNative` | | `z` | `setSort` |
| `q` / `S` / `B` | `sqlite` / `db` / `initPromise` | | `Y` | `renderLogbook` |
| `H` | `initDatabase` | | `st` | `renderEntryCard` |
| `ne` | `loadEntries` | | `it` | `toggleCard` |
| `We` | `saveEntry` | | `ot` | `loadForEditing` |
| `He` | `deleteEntry` | | `at` | `handleDelete` |
| `Qe` | `safeJsonParse` | | `ct` | `handleExport` |
| `Ve` | `ratingBar` | | `ie` | `updateBadge` |
| `Xe` | `formatMonthForExport` | | `te` | `switchView` |
| `Ke` | `buildMarkdown` | | `oe` | `setStatus` |
| `ze` | `exportLogbook` | | `ae` | `isoWeekToDate` |
| `u` / `ee` / `x` | `entries` / `sortMode` / `editingId` | | `lt` | `formatMonth` |
| `N` / `_` / `Ze` | `dateInput` / `popup` / `grid` | | `dt` | `capitalize` |
| `k` / `T` / `D` | `viewYear` / `selectedMonth` / `selectedYear` | | `Z` | `escapeHtml` |
| `et` / `Q` / `ye` | `initDatePicker` / `renderPicker` / `shiftYear` | | `f` / `fe` | `showToast` / `toastTimer` |
| `J` / `ve` | `formatYearMonth` / `setPickerValue` | | | |
