# Ledger

A personal ledger of the cities you visit: rate each one on twelve weighted
metrics, get a 0–100 score, add your impressions, and browse, search and
export your history. Formerly **Travel Logbook**.

Ledger is a [Capacitor 8](https://capacitorjs.com/) Android app with a
TypeScript + Vite web UI. Everything is stored on the device in SQLite; there
are no accounts and no network calls.

## Features

- Weighted scoring across environment, feel, food, people & safety,
  workability and overall return-desire, with a live score dial
- Month-of-visit picker; re-saving the same city and month updates the
  existing entry instead of duplicating it
- Searchable, sortable ledger (date, score, alphabetical) with expandable cards
- **Export** to `Documents/Ledger/ledger-YYYY-MM-DD.md` plus the system share
  sheet (Drive, email, …) — no storage permissions required
- **Import** a previous export (including files exported by Travel Logbook);
  the most recently saved copy of each entry wins
- Edge-to-edge layout, Android back-button handling, themed (monochrome) icon

## Requirements

| Tool | Version |
|---|---|
| Node.js | 22.12+ (`.nvmrc`) |
| JDK | 21 (Android Studio's bundled JBR works) |
| Android Studio | Current stable, with SDK Platform **37** installed |

The Android toolchain is **AGP 9.5** on **Gradle 9.8** (via the wrapper);
`compileSdk 37`, `targetSdk 36`, `minSdk 24`.

## Getting started

```bash
npm install
```

```bash
npm run sync
```

`sync` builds the web app and copies it plus the native plugins into
`android/`. Run it after every `npm install` and before opening the project
in Android Studio, since `android/capacitor-cordova-android-plugins/` and the
copied web assets are generated, not committed.

```bash
npm run android
```

That opens Android Studio; press **Run** with a device or emulator attached.
`npm run android:run` deploys from the terminal, and `npm run android:apk`
builds a debug APK at `android/app/build/outputs/apk/debug/`.

For UI work you don't need a device:

```bash
npm run dev
```

In a desktop browser the data layer falls back to `localStorage` and Export
downloads the Markdown file.

## Scripts

| Script | What it does |
|---|---|
| `dev` | Vite dev server with hot reload (browser) |
| `build` | Typecheck, then build the web bundle to `dist/` |
| `check` | ESLint + TypeScript + Vitest — run before committing |
| `test` / `test:watch` | Unit tests (Vitest) |
| `sync` | `build` + `cap sync android` |
| `android` / `android:run` / `android:apk` | Open in Android Studio / run on device / build debug APK |
| `icons` | Regenerate launcher icons from `assets/icon-source.svg` |

CI (`.github/workflows/ci.yml`) runs `check`, the web build, and an Android
`assembleDebug` + `lintDebug`, and uploads the debug APK as an artifact.

## Project layout

```
├── index.html               # App shell / markup
├── src/
│   ├── main.ts              # Entry point: state + wiring
│   ├── domain/              # Pure logic: metrics, scoring, entries
│   ├── lib/                 # Dates, Markdown export/import
│   ├── data/                # EntryStore: SQLite (native) / localStorage (web)
│   ├── platform/            # Filesystem + share-sheet export
│   ├── ui/                  # Entry form, month picker, ledger list, toasts
│   └── styles/app.css
├── tests/                   # Vitest unit tests
├── android/                 # Native Android project (committed)
├── assets/icon-source.svg   # Master app icon
├── scripts/build-icons.mjs  # Renders launcher icons from the SVG
├── capacitor.config.ts
└── vite.config.ts
```

Metric names, weights and categories live in `src/domain/metrics.ts`; the
form, cards and export are all generated from it.

## Data

Entries are stored in a SQLite database named `ledger`. Schema changes go in
`MIGRATIONS` in `src/data/sqlite-store.ts`: append a new `toVersion` step and
never edit one that has shipped. The database is included in Android Auto
Backup.

Exports are human-readable Markdown with each entry's JSON embedded in an
HTML comment, so a file can always be imported back losslessly.

### Moving data over from Travel Logbook

Ledger has a new application ID (`io.github.notmehul.ledger`), so it installs
alongside the old app rather than replacing it. To bring your entries across:
in Travel Logbook tap **Export**, then in Ledger tap **Import** and choose
the exported `logbook.md`.

## Releasing

1. Create an upload key once and keep it **outside** the repository, backed up:

   ```bash
   keytool -genkeypair -v -keystore ledger-release.jks -keyalg RSA -keysize 4096 -validity 10000 -alias ledger
   ```

2. Copy `android/keystore.properties.example` to `android/keystore.properties`
   (gitignored) and fill it in.
3. Bump `versionCode` and `versionName` in `android/app/build.gradle`.
4. `npm run sync`, then `cd android && ./gradlew bundleRelease` (AAB for Google
   Play) or `assembleRelease` (APK). Attach APKs to a GitHub Release rather
   than committing them.

## App icon

Edit `assets/icon-source.svg` and run `npm run icons`. The script renders the
legacy icon, the adaptive-icon foreground (scaled so the compass stays inside
the 66dp safe zone every launcher mask keeps), and the monochrome layer used
for Android 13+ themed icons. Keep the `#disk` / `#mark` group ids and the
`data-hub` attributes the script relies on.

## Troubleshooting

- **Gradle sync fails right after cloning** — run `npm install && npm run sync`
  first; Gradle needs the generated plugin projects.
- **"Unsupported class file major version" / JDK errors** — set Android
  Studio's Gradle JDK to 21 (Settings → Build Tools → Gradle).
- **"Failed to find target android-37"** — install *Android SDK Platform 37*
  from the SDK Manager.
- **Export says "ready to share" instead of "Saved to Documents"** — a file
  with that day's name already exists from an earlier install. The share
  sheet still works; delete the old file to save locally again.

See [ROADMAP.md](ROADMAP.md) for planned improvements.
