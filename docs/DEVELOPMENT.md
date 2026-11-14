# Developing Ledger

How Ledger is built, run and tested. For what the app does, see the [README](../README.md); for cutting a release, see [RELEASING.md](../RELEASING.md).

## Requirements

| Tool | Version |
|---|---|
| Node.js | 22.12+ (`.nvmrc`) |
| Android | JDK 21 and Android Studio with SDK Platform **37** |
| iOS | macOS with Xcode 16+ (iOS 15+ deployment target) |

Android uses **AGP 9.5** on **Gradle 9.8** (wrapper), `compileSdk` and
`targetSdk` **37**, `minSdk` 24. iOS uses Swift Package Manager; no
CocoaPods needed.

## Getting started

```bash
npm install
```

For UI work in a desktop browser (data lives in IndexedDB; exports
download):

```bash
npm run dev
```

Android — builds the web app, syncs it into `android/`, opens Android Studio:

```bash
npm run android
```

iOS — the same for Xcode:

```bash
npm run ios
```

`npm run android:run` deploys to a connected Android device from the
terminal, and `npm run android:apk` builds a debug APK at
`android/app/build/outputs/apk/debug/`. Run `npm run sync` (or
`sync:ios`) after `npm install` and before opening a native project:
copied web assets and plugin glue are generated, not committed.

## Scripts

| Script | What it does |
|---|---|
| `dev` | Vite dev server with hot reload |
| `build` | Typecheck, then build the web bundle to `dist/` |
| `check` | ESLint + svelte-check + unit tests — run before committing |
| `test` / `test:watch` | Unit tests (Vitest) |
| `test:e2e` | Build, then Playwright end-to-end tests in Chromium at phone size |
| `sync` / `sync:ios` | `build` + `cap sync` for Android / iOS |
| `android`, `android:run`, `android:apk`, `ios` | Open / run / build the native apps |
| `icons` | Regenerate Android and iOS icons and launch images from `assets/icon-source.svg` |

Locally, Playwright can reuse an installed Chromium with
`PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm run test:e2e`.

## Testing and CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`: one
job with `npm run check` (tokens, formatting, lint, types, unit tests), then a
production build and the Playwright suite against it (entries, photos, share
cards, custom metrics, every export format and backup restore, map, theme and
language). That's the gate, and it matches the other apps.

The slow suites live in `.github/workflows/full-checks.yml` and run only when
started by hand (Actions → Full checks → Run workflow), say before a big
release or after touching native code:

| Job | Covers |
|---|---|
| Android | Debug, R8-minified release and test APKs, Android lint, then Espresso-Web tests on an API 36 emulator and a launch smoke test of the minified release build |
| iOS | Simulator build with Xcode |

Run the end-to-end suite locally with `npm run test:e2e`.

## Project layout

```
├── index.html, src/main.ts   # Shell and bootstrap (load data, theme, language)
├── src/
│   ├── App.svelte            # Header, tabs, export sheet, toasts
│   ├── components/           # Entry form, ledger, map, settings, photos, …
│   │   └── ui/               # Modal and empty state (tab rail, toast and theme toggle come from dusk-dawn)
│   ├── state/                # App state (Svelte runes), import/export, sharing
│   ├── domain/               # Pure logic: metrics config, scoring, entries, document schema
│   ├── lib/                  # Markdown/JSON/zip formats, places search, share cards, dates
│   ├── data/                 # On-device files: ledger document and photos
│   ├── platform/             # Save/share files, image processing, theme
│   ├── i18n/                 # en/es/fr/de catalogues (typed against en.ts)
│   └── styles/               # app.css (imports dusk-dawn's tokens.css and components.css first)
├── tests/unit, tests/e2e     # Vitest and Playwright
├── android/, ios/            # Native projects (committed)
├── assets/icon-source.svg    # Master app icon
└── scripts/                  # Icon generator, emulator test scripts
```

## Data

The ledger is one JSON document (`ledger.json` in the app's private data
directory) holding entries, the metric configuration and settings, with
`photos/` alongside. Saves write a temporary file and rename it into
place, and changes are applied one at a time, so a crash or a burst of
edits can't corrupt or lose data. Schema changes go through `migrate` in
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
3. Bump `version` in `package.json`, `versionCode`/`versionName` in
   `android/app/build.gradle`, and `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`
   in the Xcode project.
4. `npm run sync`, then `cd android && ./gradlew bundleRelease` (AAB for
   Google Play) or `assembleRelease` (APK). Release builds are minified
   with R8.

### iOS

Open the project with `npm run ios`, set your team under *Signing &
Capabilities*, then *Product → Archive*.

## App icon

Edit `assets/icon-source.svg` and run `npm run icons`. It renders the
Android legacy icon, the adaptive-icon foreground (scaled into the 66dp
safe zone), the monochrome themed icon, and the iOS app icon and launch
image. Keep the `#disk` / `#mark` group ids and `data-hub` attributes the
script relies on.

## Troubleshooting

- **Gradle sync fails right after cloning** — run `npm install && npm run sync`
  first; Gradle needs the generated plugin projects.
- **JDK errors** — set Android Studio's Gradle JDK to 21.
- **"Failed to find target android-37"** — install *Android SDK Platform 37*.
- **Export says "ready to share" instead of "Saved to Documents"** — a file
  with that name exists from an earlier install. The share sheet still
  works; delete the old file to save locally again.

