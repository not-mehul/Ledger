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
shared cards) in IndexedDB, and the Android-only plugins (the backup folder,
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
| `check` | dusk-dawn token and contrast checks, ESLint, svelte-check, unit tests — run before committing |
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
cards, custom metrics, backup and restore, map, Insights, theme, layout and
accessibility). That's the gate, and it matches the other apps.

The slow suites live in `.github/workflows/full-checks.yml` and run only when
started by hand (Actions → Full checks → Run workflow), say before a big
release or after touching native code:

| Job | Covers |
|---|---|
| Android | Debug, R8-minified release and test APKs, Android lint, then Espresso-Web tests on an API 36 emulator and a launch smoke test of the minified release build |

Run the end-to-end suite locally with `npm run test:e2e`.

## Project layout

```
├── index.html, src/main.ts   # Shell and bootstrap (load data, theme, language, backup check)
├── src/
│   ├── App.svelte            # Header, tabs, settings screen, toasts
│   ├── components/           # Entry form, ledger, map, settings, …
│   │   ├── insights/         # Year in Review, patterns, rankings, value signals
│   │   └── ui/               # Modal, empty state, icons (tabs and toast come from dusk-dawn)
│   ├── state/                # App state (Svelte runes): ledger, backup, restore, sharing
│   ├── domain/               # Pure logic: metrics config, scoring, entries, insights, document schema
│   ├── lib/                  # Backup format, places search, share cards, dates
│   ├── data/                 # On-device files: the ledger document
│   ├── platform/             # Native bridges: backup folder, widget, links, sharing, theme
│   ├── i18n/                 # en/es/fr/de catalogues (typed against en.ts), chosen from the phone
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

### Backup

Backup works as BookShelf's does. The person picks a folder through
Android's folder picker (`FolderSyncPlugin.java`, `src/state/backup.svelte.ts`)
and Ledger keeps one file there, `ledger-backup.json`: every entry and the
metric configuration. When a backup is due (daily, weekly, monthly or never,
checked as the app opens and resumes) Ledger reads the file, merges it with
the ledger (newest copy of each entry wins, and deletions carry over through
`syncBase`), and writes the result back. So two phones that back up to the
same synced folder stay in step. **Restore a backup** in Settings merges any
`ledger-backup.json`, or a `.zip` backup from 2.x, in the same way.

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

The icon is Ledger's score dial, open at the bottom, around a map pin, on the
same dark tile and amber corner brackets as BookShelf's. Edit
`assets/icon-source.svg` (drawn on the 108-unit adaptive-icon grid) and run
`npm run icons`. It renders the legacy icon (the whole tile), the adaptive
foreground and splash icon (`#mark` alone, inside the safe zone, over
`drawable/ic_launcher_background.xml`), the monochrome themed icon, and copies
the source to `public/favicon.svg`. Keep the `#mark` group and the
`data-track` and `data-dot` attributes the script relies on.

## Troubleshooting

- **Gradle sync fails right after cloning** — run `npm install && npm run sync`
  first; Gradle needs the generated plugin projects.
- **JDK errors** — set Android Studio's Gradle JDK to 21.
- **"Failed to find target android-37"** — install *Android SDK Platform 37*.
- **"The backup didn't finish"** — the folder was moved, deleted or its
  permission revoked. Choose it again in Settings → Backup.

