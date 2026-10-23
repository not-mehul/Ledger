# Travel Logbook — Code Audit

Audit of `travel_logbook.apk` (package `com.travellogbook.app`, versionName 1.0 / versionCode 1).
All findings come from the decompiled APK. Line references point to the readable reconstruction in
[`source/src/`](source/src). It was checked against the shipped bundle and gives byte-identical behaviour; see the
[README](README.md#how-the-reconstruction-was-verified). The original minified code is in
[`decompiled/web-pretty/index-DJyC1WZe.js`](decompiled/web-pretty/index-DJyC1WZe.js) (app logic is lines 31–163
and 1425–2256), and the [README](README.md#name-map) maps minified names to reconstructed ones.

Severity: **High** means data loss, a security or policy problem, or something that blocks a release.
**Medium** means wrong behaviour users will notice. **Low** means polish, hardening or latent issues.
Findings marked ✅ were reproduced by running the original bundle in Chromium.

---

## 1. Executive summary

Travel Logbook is a small, well-styled **Capacitor 7** app. About 600 lines of vanilla JavaScript let you rate a city
on 12 weighted metrics, store the ratings in SQLite (or localStorage in a browser), browse and search them, and
export them to Markdown. The UI code is tidy and readable, and user text is HTML-escaped in the main places.
The weaknesses are mostly around the app rather than its core logic:

| # | Top issues | Severity |
|---|---|---|
| 1 | **The APK is unsigned** (no v1 JAR signature, no v2/v3 signing block), so it can't be installed or published as-is. | High |
| 2 | **A deleted entry comes back.** Deleting an entry while it is loaded in the form, then pressing "Update Entry", silently restores it on the next launch. ✅ | High |
| 3 | **A timezone bug rewrites stored dates.** In UTC+ zones such as IST, legacy week-format dates show a month early, and editing them saves the wrong month permanently. ✅ | High |
| 4 | **Saves and deletes update the UI before the database write**, with no rollback. A failed write shows "Saved", wipes the form, and the entry disappears on restart. | High |
| 5 | **`MANAGE_EXTERNAL_STORAGE` is declared but does nothing useful**, and export never reaches Downloads on Android 6–12. This is a Play policy risk and a broken feature. | High |
| 6 | **19.4 MB of the 23.9 MB APK (81%) is SQLCipher**, shipped for 4 ABIs while encryption is turned off. R8 is disabled, so about 3,800 library classes ship for one 7-line activity. | Medium |
| 7 | **Three different score colour scales**: 58.9 shows amber "Decent" in the app but 🔴 in the export. ✅ | Medium |

---

## 2. What's inside the APK

```
travel_logbook.apk (23.9 MB, unsigned)
├── classes*.dex ──────────── Capacitor 7 runtime + plugins + AndroidX + Kotlin (~3,800 classes; not minified)
│   └── com.travellogbook.app.MainActivity   ← the ONLY app class: `extends BridgeActivity {}`
├── lib/{arm64-v8a,armeabi-v7a,x86,x86_64}/libsqlcipher.so   ← 19.4 MB, stored uncompressed
└── assets/public/ ─────────── the actual app (Vite build)
    ├── index.html             1,208 lines: markup + 950 lines of inline CSS
    └── assets/index-*.js      app logic + @capacitor/core + sqlite/filesystem JS shims
        ├── web-Dx0FgJME.js    @capacitor-community/sqlite web impl (dead, see §4)
        └── web-_yIeJ1hf.js    @capacitor/filesystem web impl (dead, see §4)
```

| Fact | Value |
|---|---|
| Framework | Capacitor 7.x (`@capacitor/core`), Vite build, vanilla JS (no UI framework) |
| Plugins | `@capacitor-community/sqlite` 7.0.x, `@capacitor/filesystem` 7.1.x |
| SDK levels | minSdk 23 (Android 6), target/compile 35 (Android 15), AGP 8.7.2 |
| Permissions | `INTERNET`, `MANAGE_EXTERNAL_STORAGE`, `USE_BIOMETRIC`, `USE_FINGERPRINT` |
| Storage | SQLite DB `logbook` (unencrypted) on device; `localStorage["tlb_entries"]` in a browser |
| Signing | **none** |
| Code shrinking | R8 off (Kotlin stdlib and AndroidX class names intact); resource paths shortened |

**Data model** (single table, [storage.js:32-45](source/src/storage.js#L32-L45)):
`entries(id TEXT PK, city, state, date 'YYYY-MM', score REAL, ratings JSON-TEXT, notes, savedAt ISO)`.

**Scoring** ([main.js:100-106](source/src/main.js#L100-L106)): `score = Σ(rating × weight) / (Σweight × 10) × 100`.
There are 12 metrics with weights from 1 to 2 (total weight 17.5), and each rating is 1–10.

---

## 3. Findings

### 3.1 Correctness and data integrity

#### B1 · High · The ISO-week date conversion is timezone-dependent and corrupts dates when an entry is edited ✅

*Where:* [dates.js:3-11](source/src/dates.js#L3-L11), duplicated in [export.js:12-30](source/src/export.js#L12-L30)

`isoWeekToDate()` builds a *local* midnight `Date`, then reads it back with `toISOString()` (UTC). East of UTC the
day moves back by one. When a week's Monday is the 1st of a month, the month moves back too. Under `Asia/Kolkata`,
`2024-W14` shows as **"March 2024"** (it should be April) and `2024-W01` shows as "December 2023". Because
`loadForEditing()` feeds the converted value into the picker, **saving the edit stores `2024-03` permanently**.
In UTC the same entry shows April.

*Fix:* format with local getters (`getFullYear()`/`getMonth()`) instead of `toISOString()`. Better still, run a
one-time migration that rewrites every `-W` date to `YYYY-MM`, then delete the week-format code entirely (§4).

#### B2 · High · A deleted entry comes back after an edit ✅

*Where:* [main.js:136-202](source/src/main.js#L136-L202), [main.js:364-383](source/src/main.js#L364-L383)

Steps: Logbook → *Edit* entry A → Logbook → *Delete* A → back to Entry → *Update Entry*.
`handleDelete()` never clears `editingId`, so the button still says "Update Entry". In `handleSave()`,
`findIndex` returns −1, so the in-memory list stays unchanged and no toast appears. But `saveEntry()` still runs
`INSERT OR REPLACE` (or appends in localStorage). The UI shows "0 entries", and **A is back after a relaunch**.

*Fix:* in `handleDelete`, call `clearForm()` when `id === editingId`. In `handleSave`, stop (or save as new) when the
entry being edited no longer exists.

#### B3 · High · Optimistic writes with no rollback

*Where:* [main.js:167-201](source/src/main.js#L167-L201), [main.js:369-382](source/src/main.js#L369-L382)

`handleSave()` changes `entries`, shows "Saved: …" and **clears the form** before `await saveEntry()`. If the write
fails, the user gets a success toast followed by "Save failed", their typed notes are gone, and the entry only
exists in memory until restart. `handleDelete()` has the same problem in reverse: the card disappears, then comes
back on the next launch.

*Fix:* persist first, then update state and the UI. On failure, keep the form intact. Disable the button while saving.

#### B4 · Medium · A database start-up failure is permanent and hidden

*Where:* [storage.js:15-48](source/src/storage.js#L15-L48), [main.js:25-36](source/src/main.js#L25-L36)

`initPromise` caches a *rejected* promise, so there is never a retry. After the `catch`, `setStatus()` still paints the
**green "connected" dot with "0 entries"**, so a user whose DB failed to open is told they have no data. Every later
save then throws on the `null` `db`.

*Fix:* reset `initPromise` on failure, show an error state in the status bar instead of "connected", and offer a
retry or export-raw-data path.

#### B5 · Medium · Export never reaches Downloads on Android 6–12, and the message tells users to do something that won't help

*Where:* [export.js:82-144](source/src/export.js#L82-L144), [AndroidManifest.xml](decompiled/android/AndroidManifest.xml)

The manifest declares neither `READ_` nor `WRITE_EXTERNAL_STORAGE`. Here is what the decompiled Filesystem plugin
(`FilesystemPlugin.isStoragePermissionGranted`) does:
- **API 23–29:** `requestPermissions()` is rejected with *"Missing the following permissions in AndroidManifest.xml"*.
  The empty `catch {}` at [export.js:107](source/src/export.js#L107) swallows it, and the write to
  `EXTERNAL_STORAGE` fails.
- **API 30–32:** `writeFile` needs `READ_EXTERNAL_STORAGE`, which isn't declared, so it fails the same way.
- **API 33+:** the write works, but always to the fixed name `logbook.md`. It overwrites silently and starts failing
  after a reinstall, because the old install owns the file.

In the first two cases the file ends up in `Android/data/com.travellogbook.app/files/logbook.md`, which is hard to
find, and the toast tells users to grant *"All files access"*. That setting doesn't exist before Android 11, and the
plugin never checks it. (Derived from the decompiled plugin; worth a quick on-device confirmation.)

*Fix:* drop direct file writes. Use the **Share sheet** (`@capacitor/share` after writing to `Directory.Cache`) or a
Storage Access Framework "Save as…" (`ACTION_CREATE_DOCUMENT`). Neither needs a permission. Add a timestamp to the
file name.

#### B6 · Medium · Date sort breaks on legacy dates and has no tie-breaker ✅

*Where:* [main.js:268-274](source/src/main.js#L268-L274), [export.js:53-54](source/src/export.js#L53-L54)

`new Date("2024-W14")` is `Invalid Date`, so the comparator returns `NaN` and the order becomes undefined. In testing,
a 2024 entry sorted *above* 2025 entries under "Date". Entries from the same month come back in arbitrary order.

*Fix:* compare `YYYY-MM` strings directly (they sort lexically), with `savedAt` as a tie-breaker.

#### B7 · Medium · Three inconsistent score colour scales ✅

| Place | Green | Amber/yellow | Red |
|---|---|---|---|
| Live score ring ([main.js:115-131](source/src/main.js#L115-L131)) | ≥85 (and ≥72 light green) | ≥58 (≥42 brown) | <42 |
| Logbook card ([main.js:280-281](source/src/main.js#L280-L281)) | ≥75 | ≥58 | <58 |
| Markdown export ([export.js:56](source/src/export.js#L56)) | ≥85 | ≥65 | <65 |

So 58.9 is "Decent"/amber in the app but 🔴 in the export, and 80 is green on the card, light-green "Strong" in the
form, and 🟡 in the export.

*Fix:* use one `scoreBand(score) → {label, color, emoji}` helper everywhere.

#### B8 · Medium · Missing ratings default to different values in different places

The score and the export treat a missing rating as **5** ([main.js:103](source/src/main.js#L103),
[export.js:66](source/src/export.js#L66)). The card breakdown shows it as **0/10**
([main.js:288](source/src/main.js#L288)). This affects every older entry, and every entry once you add a metric.
Because the score is *stored* rather than derived, editing an old entry can also change its score even when nothing
was touched. In the test, a legacy entry went from 61.2 to 52.6.

*Fix:* pick one rule (prefer "unrated", excluded from the weighted mean) and derive the score from the ratings when
reading.

#### B9 · Low · The score panel keeps the old colour after Clear or Save ✅

`clearForm()` ([main.js:204-223](source/src/main.js#L204-L223)) resets each slider through `updateMetric()`. That
calls `updateScore()` (50 → "Mixed", brown), and then only the *text* is reset. The placeholder ends up tinted
`#c08050` and the ring stroke stays brown.

#### B10 · Low · The initial score shows "—", but an untouched form saves 50.0

All sliders start at 5. The panel says "Rate the metrics below…", yet saving gives 50/100. Either show 50.0 from the
start or keep sliders "unset" until the user touches them.

#### B11 · Low · Duplicate detection only runs for new entries

New entries are matched on (city, state, month) ([main.js:174-179](source/src/main.js#L174-L179)), but an *edit* can
change an entry to match another one, leaving two entries for the same city and month.

#### B12 · Low · Export format issues

- `<!-- data:{json} -->` ([export.js:59](source/src/export.js#L59)) breaks if any note contains `-->`. It is also
  write-only, because no importer exists (§4).
- City, state and notes go into the Markdown unescaped.
- "Total cities logged" counts *entries*, not distinct cities.
- The web path calls `URL.revokeObjectURL()` synchronously after `click()` ([export.js:91](source/src/export.js#L91)),
  which can cancel the download in some browsers. Revoke it in a `setTimeout`.

#### B13 · Low · Other latent issues

- IDs come from `Date.now().toString(36)` ([main.js:157](source/src/main.js#L157)). That's fine for one device, but
  collision-prone once you add import or sync. Use `crypto.randomUUID()`.
- Start-up race: if a save finishes before `entries = await loadEntries()`
  ([main.js:29](source/src/main.js#L29)) resolves, the in-memory list can be overwritten.
- The year picker has no bounds, so visits can be logged in the future.
- `savedAt` is overwritten on every edit, so creation time is lost.

### 3.2 Security and privacy

#### S1 · High · `MANAGE_EXTERNAL_STORAGE` is declared

It is never requested (there's no `ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION` intent), the Filesystem plugin never
checks it (B5), and Google Play only allows it for file managers, backup apps and similar. Publishing would be
rejected or would need a policy declaration. *Remove it.*

#### S2 · Medium · Personal location history is stored unencrypted while the encryption library ships anyway

`createConnection(..., "no-encryption", ...)` ([storage.js:27](source/src/storage.js#L27)) and
`androidIsEncryption: false` mean the database is plaintext, yet the full SQLCipher engine (19.4 MB) ships. Where
and when you were, plus your private impressions, is sensitive. *Decide one way:* either turn on SQLCipher (the
plugin can keep the passphrase in Android Keystore-backed `EncryptedSharedPreferences`, optionally gated by
biometrics, and both dependencies are already bundled), or drop SQLCipher and keep the APK small.

#### S3 · Medium · `allowBackup="true"` with no backup rules

The database and WebView storage go into Google cloud backup, and on Android ≤ 11 into `adb backup` too. That may
well be what you want for a personal log (it survives a phone change), but make it explicit with
`android:dataExtractionRules` and `android:fullBackupContent`, especially if you turn on encryption (S2). The key
won't migrate, so a restored encrypted DB would be unreadable.

#### S4 · Low · Unneeded permissions

`INTERNET` isn't needed: the app makes no network calls. Removing it hardens the WebView. `USE_BIOMETRIC` and
`USE_FINGERPRINT` are merged in from the sqlite plugin and never used. Strip them with
`tools:node="remove"` unless you build the biometric lock from S2.

#### S5 · Low · The FileProvider shares all of external storage

[file_paths.xml](decompiled/android/res/xml/file_paths.xml) contains `<external-path path=".">` and
`<cache-path path=".">`. This is the Capacitor template default. It isn't exported, so the risk is low, but the app
never shares files through it. Narrow it to a single `cache-path name="exports" path="exports/"` if you adopt the
Share-sheet export.

#### S6 · Low · `innerHTML` rendering escapes some fields but not others; no CSP

`city`, `state` and `notes` are escaped ([main.js:318](source/src/main.js#L318),
[main.js:303](source/src/main.js#L303)), but `id`, `score`, ratings and `formatMonth(date)` go in raw. When `date`
isn't `YYYY-MM`, `formatMonth` returns the stored string unchanged ([dates.js:23](source/src/dates.js#L23)). Today that
is only reachable through tampered storage. **Once you add import (§6) it becomes a real XSS vector.** Escape every
interpolation, or build nodes with `textContent`. Add a CSP meta tag such as
`default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:`.

#### S7 · Low · Cordova leftovers

`res/xml/config.xml` has `<access origin="*"/>`, and there are empty `cordova.js` and `cordova_plugins.js` files.
These are template noise; Capacitor doesn't use the allow-list.

### 3.3 Build and release

#### R1 · High · The APK is unsigned

There's no `META-INF/*.RSA|SF` and no "APK Sig Block 42", so Android won't install
it. Set up a release `signingConfig` with an upload keystore, back the keystore up somewhere other than the repo, and
ship an **AAB** through Play App Signing.

#### R2 · Medium · No code shrinking

R8 is off: `kotlin.*` and `androidx.*` names are intact, and unused Room
(88 classes), biometric and security-crypto all ship. Set `minifyEnabled true` and `shrinkResources true`. Capacitor's
consumer ProGuard rules already keep what the bridge needs.

#### R3 · Medium · APK size: 23.9 MB for about 85 KB of app code

81% of it is SQLCipher for four ABIs, including the
two emulator ABIs (`x86`, `x86_64`). An AAB alone delivers one ABI per device, which brings the download to about
9–10 MB. Dropping SQLCipher (S2, "or" branch) brings the APK under 5 MB, and to about 2–3 MB with R8. Alternatives: `@capacitor/preferences` or a JSON file through
Filesystem, which is ample for a few hundred entries, or a plugin built on the platform SQLite.

#### R4 · Low · Versioning

It's still `versionCode 1` / `1.0`. Adopt semver and derive `versionCode` from it in CI.

#### R5 · Low · No source of truth

Until now, only the APK existed. [`source/`](source) is now a rebuildable project,
but the Android Gradle project has to be regenerated (`npx cap add android`, see [README](README.md#rebuilding)).
Commit `android/` this time.

#### R6 · Low · Vite's modulepreload polyfill ships unnecessarily

It isn't needed. The Chromium WebView supports modulepreload, so set
`build.modulePreload.polyfill = false`.

### 3.4 UX and accessibility

#### A1 · Medium · Text is too small

Labels are 8–10 px: `.slider-weight` is 0.5rem, `.field-label` and
`.slider-ends` are 0.5625rem, and tabs, buttons, metric names and the meta line are 0.625rem. The Android WebView
scales these with the system font size, but the base is so small that they stay hard to read at default settings.
Aim for 12 px minimum.

#### A2 · Medium · Contrast

`--text-dim` (#78716c) on the background is **4.0:1** (3.9:1 on panels), below the
WCAG AA 4.5:1 minimum. It's used on the smallest text: slider end labels, the sort label, placeholders and the empty
state.

#### A3 · Medium · Controls aren't semantic

- Month cells are `<div>`s with click handlers, so they aren't focusable and have no role.
- The card header is a clickable `<div>`.
- Tabs lack `role="tab"` and `aria-selected`.
- Metric names are `<span>`s, not `<label for>`, so sliders have no accessible name and no `aria-valuetext`.
- The toast lacks `role="status"` / `aria-live`, so TalkBack never announces "Saved".

#### A4 · Medium · The Android back button leaves the app from anywhere

`BridgeActivity` has no back handling and
`@capacitor/app` isn't installed, so Back from the Logbook tab, or with the date picker open, leaves the app. The
in-progress form isn't saved as a draft, so it's lost if the process is killed.

#### A5 · Low · Splash and launch

The launcher icon is custom, but the splash is still the **default Capacitor logo
on white** ([splash.png](decompiled/android/res/drawable-port-xxxhdpi/splash.png)). That causes a white flash before a
dark UI. The base `AppTheme` is also `Light.DarkActionBar`. Use a dark splash with your icon.

#### A6 · Low · Edge-to-edge (Android 15)

Because target SDK is 35, Android 15 forces edge-to-edge. The app relies on
`env(safe-area-inset-*)`, and Capacitor's `adjustMarginsForEdgeToEdge` defaults to `"disable"`. Check on an Android
15 device. If the header sits under the status bar, set `"android": { "adjustMarginsForEdgeToEdge": "auto" }`.

#### A7 · Low · Wording drift

- The tab says "Entry", but the empty state says "the New Entry tab".
- Form headings ("Feel", "Workability") differ from card and export labels ("City Feel", "Practical").
- The `saveHint` slot, meant for hints, holds "Designed by Mehul".

#### A8 · Low · Other interaction issues

Deleting uses a blocking `confirm()` with no undo. Hover styles stick on
touch. The search box re-renders every card on each keystroke, which collapses any expanded card.

### 3.5 Performance

#### P1 · Medium · GPU-heavy background

There are three fixed, 600–1000 px radial gradients with
`filter: blur(40–60px)`, plus `backdrop-filter: blur()` on every panel, card, the tab bar and the toast. On low-end
Android WebViews this is the main source of scroll jank. Blurring a soft radial gradient is nearly invisible, so drop
the `filter`s and most `backdrop-filter`s (the panels are almost opaque anyway).

#### P2 · Low · Full re-render on every search keystroke

This is fine below about 100 entries. Debounce the search and
toggle visibility instead of rebuilding HTML.

### 3.6 Code structure and maintainability

- **D1 — No migration path.** `DB_VERSION = 1` is never used. The schema comes only from `CREATE TABLE IF NOT EXISTS`,
  so the first column you add will need the plugin's `addUpgradeStatement`. Wire it up before you need it.
- **D2 — Several sources of truth for categories.** Form headings and container IDs are hard-coded in `index.html`,
  with `CATEGORY_CONTAINERS` and `METRIC_GROUPS` maintained separately in [metrics.js](source/src/metrics.js). That
  drift has already happened (A7). Generate the form panels, card groups and export sections from one `CATEGORIES`
  array. `metric.high` is also redundant: it always equals `weight >= 2`.
- **D3 — The score is stored, not derived.** Change a weight and every stored score is stale. Compute it on read,
  or store a `weightsVersion`.
- **D4 — Timestamps.** Use `createdAt` and `updatedAt` instead of a single `savedAt` that gets overwritten.
- **D5 — Ratings are stored as a JSON string.** That's fine now, but it rules out SQL aggregation such as
  "average safety by country". Consider a `ratings(entry_id, metric_id, value)` table if you build statistics.
- **D6 — General hygiene.**
  - State is global and mutable, and there are 53 `document.getElementById` calls.
  - There are no tests and no types.
  - 950 lines of CSS are inline in `index.html`.

  Suggested path: TypeScript, a small `state.js`, unit tests (Vitest) for `computeScore`, the date helpers and
  `buildMarkdown`, and the Playwright scenario in [`tools/equivalence-check.mjs`](tools/equivalence-check.mjs) as a
  smoke test.

---

## 4. Dead code and unused weight

| Item | Where | Why it's dead | Action |
|---|---|---|---|
| SQLite web implementation chunk (9.6 KB) | `web-Dx0FgJME.js` | In a browser the app uses localStorage and never calls the plugin. It also needs a `<jeep-sqlite>` element that isn't included, so it would fail if it ever loaded. | Remove the web registration, or use one storage path everywhere |
| Filesystem web implementation chunk (8.7 KB) | `web-_yIeJ1hf.js` | Web export uses a Blob download and never calls `Filesystem` | Disappears with the Share/SAF export (B5) |
| `idx_entries_date`, `idx_entries_score` | [storage.js:43-44](source/src/storage.js#L43-L44) | The only query is `SELECT *` with no `WHERE` or `ORDER BY`; sorting happens in JS | Drop them, or sort in SQL |
| `DB_VERSION` | [storage.js:5](source/src/storage.js#L5) | Never used for upgrades | Use it (D1) |
| `setStatus(text, persisted)` second parameter | [main.js:409](source/src/main.js#L409) | Never read | Remove it, or use it for the error state (B4) |
| `"Please select a date."` branch | [main.js:149-152](source/src/main.js#L149-L152) | Unreachable: the date field is read-only and always holds a value | Remove |
| ISO-week (`-W`) handling | `isoWeekToDate`, `formatMonth`, `formatMonthForExport`, `loadForEditing`, `setPickerValue` | Only for data from an earlier build that used `<input type="week">`; buggy (B1) | Migrate once, then delete |
| `formatMonthForExport()` | [export.js:12-30](source/src/export.js#L12-L30) | Line-for-line copy of `formatMonth()` | Import the shared helper |
| `loadForEditing` pre-converting `-W` | [main.js:345](source/src/main.js#L345) | `setPickerValue()` converts again anyway | Remove |
| `<!-- data:… -->` and `<!-- exportedAt:… -->` | [export.js:50,59](source/src/export.js#L50) | Written for a re-import that doesn't exist | Build the importer (§6) or drop them |
| `.weight-tag` CSS rule | `index.html` | No element uses the class | Remove |
| `id="saveHint"` | `index.html` | Never referenced | Remove the ID, or use it for real hints |
| `cordova.js`, `cordova_plugins.js`, `config.xml`, `org.apache.cordova.*` | APK | Capacitor's Cordova compatibility layer; no Cordova plugins are used | Leave (template), or ignore |
| `CapacitorCookies` / `CapacitorHttp` web shims, Filesystem "Synapse" bootstrap | bundled by `@capacitor/core` and `@capacitor/filesystem` | The app makes no HTTP calls | Unavoidable side effects of the libraries; note only |
| **Native:** Room (88 classes), `androidx.biometric`, `androidx.security-crypto` | `classes.dex` | Pulled in by the sqlite plugin and unused with encryption off | R8 strips Room; the others go if SQLCipher goes |
| **Native:** SQLCipher `.so` ×4 (19.4 MB) | `lib/*` | Encryption disabled | Turn encryption on, or switch storage (S2/R3) |
| **Manifest:** `INTERNET`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, `MANAGE_EXTERNAL_STORAGE`, broad FileProvider | `AndroidManifest.xml` | Unused | Remove (S1, S4, S5) |
| Vite modulepreload polyfill | top of `index-*.js` | WebView supports modulepreload natively | `modulePreload.polyfill = false` |

---

## 5. Suggested fix order

**Phase 0 — before anyone else installs it (about a day)**
1. Sign the build and produce an AAB (R1).
2. Remove `MANAGE_EXTERNAL_STORAGE`; replace export with the Share sheet or SAF (S1, B5).
3. Fix the deleted-entry-returns bug and switch to persist-then-render (B2, B3).
4. Fix `isoWeekToDate` and add a one-time `-W` → `YYYY-MM` migration (B1, B6).

**Phase 1 — polish (2–3 days)**
5. One `scoreBand()` helper and one missing-rating rule; derive the score on read (B7, B8, D3).
6. Visible DB error state with retry (B4); clear-form colour reset (B9).
7. R8, resource shrinking, and stripping unused permissions (R2, S4).
8. Dark splash, Back-button handling (`@capacitor/app`), edge-to-edge check (A4–A6).
9. Accessibility pass: minimum font sizes, `--text-dim` contrast, semantic controls, `aria-live` toast (A1–A3).
10. Remove the `filter: blur` glow layers (P1).

**Phase 2 — foundations for new features**
11. A single `CATEGORIES` config that drives the form, cards and export (D2).
12. Schema migrations, `createdAt`/`updatedAt`, UUID IDs (D1, D4, B13).
13. TypeScript, Vitest unit tests, and the Playwright smoke test in CI.
14. Decide on encryption and backup policy together (S2, S3).

---

## 6. Future expansions

Ordered roughly by value for effort. The metrics (internet speed, workability, "a serious contender") suggest the app
is used to **shortlist cities to live or work remotely in**, so most ideas lean that way.

**Make the data portable and safe**
- **Import and restore.** Read back the JSON already embedded in exports, or better, a dedicated `logbook.json`
  backup. Escape everything on render first (S6).
- **Optional encrypted sync or backup.** Write an encrypted file to a user-chosen SAF location such as Google Drive,
  or sync to a small backend with client-side encryption, so the log survives a phone change.
- **App lock** with biometrics plus SQLCipher. The plugin already supports both (S2).

**Make the ratings more useful**
- **Custom metrics and weight presets.** Let users add, rename or reweight metrics, with presets such as
  *Remote-work base*, *Holiday* and *Relocation*. Re-score all entries instantly (needs D2 and D3).
- **Multiple visits per city.** Add a `cities` table with many `visits`, show a score trend over time, and say
  "you rated it higher in spring".
- **Compare mode.** Show 2–3 cities side by side with a per-category radar or bar chart and the winning metric
  highlighted.
- **Statistics.** Countries and cities visited, averages by category, top city per metric, and a "year in travel"
  summary.

**Richer entries**
- **City autocomplete** from a small offline dataset such as GeoNames `cities15000` (about 1 MB). It normalises
  names, which improves de-duplication, and provides coordinates.
- **Map view.** Plot visited cities coloured by score band (Leaflet with an offline tile cache, or a simple SVG world
  map).
- **Photos per entry** (`@capacitor/camera`, stored in the app's private files) and a hero image on the card.
- **Hard numbers next to feelings.** Record rent, coffee price, a measured internet speed (run a quick speed test when
  you rate "Internet"), stay length and trip type tags.
- **Opt-in data enrichment.** Climate normals, air-quality averages (OpenAQ) and timezone offset from home. Keep it
  off by default, since the app is currently fully offline.

**Reach and convenience**
- **iOS build.** Capacitor makes it nearly free: `npx cap add ios`. The CSS already handles safe areas.
- **Installable web app (PWA).** The browser build already works on localStorage; add a manifest and service worker.
- **Shareable city card.** Render the score ring and top metrics to a PNG to share.
- **Home-screen quick-add widget** and an optional "you've been in X for a week — rate it?" nudge.
- **Localisation.** Dates are hard-coded to `en-US`; use the device locale and translatable strings.
- **Notes assistant (optional and online).** Summarise free-text impressions into pros and cons, or suggest
  similar cities from your own ratings.
