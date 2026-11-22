# Developing Ledger

How Ledger is built, run and tested. For what the app does, see the [README](../README.md); for cutting a release, see [RELEASING.md](../RELEASING.md).

## Requirements

| Tool | Version |
|---|---|
| Node.js | 22.12+ (`.nvmrc`) |
| Android | JDK 21 and Android Studio with SDK Platform **37** |

Android uses **AGP 9.5** on **Gradle 9.8** (wrapper), `compileSdk` and
`targetSdk` **37**, `minSdk` **29** (Android 10). Ledger is Android only.

## Getting started

```bash
npm install
```

Ledger ships only as an Android app. The web build runs it in a desktop
browser for UI work and for the Playwright tests: it takes the app's
Android code path, with `@capacitor/filesystem` keeping files (the ledger,
exports, backups) in IndexedDB, and the Android-only plugins (folder sync,
the widget) failing gently:

```bash
npm run dev
```

Android — builds the web app, syncs it into `android/`, opens Android Studio:

```bash
npm run android
```

`npm run android:run` deploys to a connected Android device from the
terminal, and `npm run android:apk` builds a debug APK at
`android/app/build/outputs/apk/debug/`. Run `npm run sync` after `npm install` and before opening a native project:
copied web assets and plugin glue are generated, not committed.

## Scripts

| Script | What it does |
|---|---|
| `dev` | Vite dev server with hot reload |
| `build` | Typecheck, then build the web bundle to `dist/` |
| `check` | ESLint + svelte-check + unit tests — run before committing |
| `test` / `test:watch` | Unit tests (Vitest) |
| `test:e2e` | Build, then Playwright end-to-end tests in Chromium at phone size |
| `sync` | `build` + `cap sync android` |
| `android`, `android:run`, `android:apk` | Open / run / build the Android app |
| `icons` | Regenerate the Android launcher icons from `assets/icon-source.svg` |

Locally, Playwright can reuse an installed Chromium with
`PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm run test:e2e`.

## Testing and CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`: one
job with `npm run check` (tokens, formatting, lint, types, unit tests), then a
production build and the Playwright suite against it (entries, share
cards, custom metrics, every export format and backup restore, map, theme and
language). That's the gate, and it matches the other apps.

The slow suites live in `.github/workflows/full-checks.yml` and run only when
started by hand (Actions → Full checks → Run workflow), say before a big
release or after touching native code:

| Job | Covers |
|---|---|
| Android | Debug, R8-minified release and test APKs, Android lint, then Espresso-Web tests on an API 36 emulator and a launch smoke test of the minified release build |

Run the end-to-end suite locally with `npm run test:e2e`.

## Project layout

```
├── index.html, src/main.ts   # Shell and bootstrap (load data, theme, language)
├── src/
│   ├── App.svelte            # Header, tabs, export sheet, toasts
│   ├── components/           # Entry form, ledger, map, settings, …
│   │   └── ui/               # Modal and empty state (tab rail, toast and theme toggle come from dusk-dawn)
│   ├── state/                # App state (Svelte runes), import/export, sharing
│   ├── domain/               # Pure logic: metrics config, scoring, entries, document schema
│   ├── lib/                  # Markdown/JSON/zip formats, places search, share cards, dates
│   ├── data/                 # On-device files: the ledger document
│   ├── platform/             # Save/share files, image processing, theme
│   ├── i18n/                 # en/es/fr/de catalogues (typed against en.ts)
│   └── styles/               # app.css (imports dusk-dawn's tokens.css and components.css first)
├── tests/unit, tests/e2e     # Vitest and Playwright
├── android/                  # Native project (committed)
├── assets/icon-source.svg    # Master app icon
└── scripts/                  # Icon generator, emulator test scripts
```

## Data

The ledger is one JSON document (`ledger.json` in the app's private data
directory) holding entries, the metric configuration and settings. Saves
write a temporary file and rename it into place, and changes are applied
one at a time, so a crash or a burst of edits can't corrupt or lose data.
A ledger that is there but can't be read is never overwritten: it is
renamed to `ledger.unreadable-<time>.json`, a new ledger starts, and
Settings says where the old file went. Ledger no longer keeps photos;
entries and backups from older versions that had them import without
them. Schema changes go through `migrate` in
`src/domain/doc.ts`: bump `SCHEMA_VERSION`, add a step, and never edit
one that has shipped.

Exports embed each entry's JSON (and the metric configuration), so any
export can be imported back losslessly.

### Moving data over from Travel Logbook

Ledger has a new application ID (`io.github.notmehul.ledger`), so it
installs alongside the old app. In Travel Logbook tap **Export**, then in
Ledger go to **Settings → Data & backups → Import** and choose
`logbook.md`.

## Releasing

### Android

1. Create an upload key once and keep it **outside** the repository, backed up:

   ```bash
   keytool -genkeypair -v -keystore ledger-release.jks -keyalg RSA -keysize 4096 -validity 10000 -alias ledger
   ```

2. Copy `android/keystore.properties.example` to `android/keystore.properties`
   (gitignored) and fill it in.
3. Pick the version: the tag sets it (RELEASING.md), and it must be higher
   than every earlier release and than 2.1.0.
4. `npm run sync`, then `cd android && ./gradlew bundleRelease` (AAB for
   Google Play) or `assembleRelease` (APK). Release builds are minified
   with R8.

## App icon

Edit `assets/icon-source.svg` and run `npm run icons`. It renders the
Android legacy icon, the adaptive-icon foreground (scaled into the 66dp
safe zone) and the monochrome themed icon. Keep the `#disk` / `#mark` group ids and `data-hub` attributes the
script relies on.

## Troubleshooting

- **Gradle sync fails right after cloning** — run `npm install && npm run sync`
  first; Gradle needs the generated plugin projects.
- **JDK errors** — set Android Studio's Gradle JDK to 21.
- **"Failed to find target android-37"** — install *Android SDK Platform 37*.
- **Export says "ready to share" instead of "Saved to Documents"** — a file
  with that name exists from an earlier install. The share sheet still
  works; delete the old file to save locally again.

