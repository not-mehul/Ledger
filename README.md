# Travel Logbook — Android

The original Travel Logbook web app, packaged as a native Android app via Capacitor.

- **UI:** the original HTML/CSS/JS, untouched visually
- **Storage:** native SQLite (via `@capacitor-community/sqlite`)
- **Export:** writes `logbook.md` to your device's `Downloads/` folder, with the export date stamped into the document header
- **Target:** Android 16+ only (per your setup) — no legacy compatibility cruft

---

## What changed vs. the web version

| Original web app | This Android version |
|---|---|
| `localStorage` for persistence | **SQLite** (16 KB-page-size aligned, queryable, robust) |
| File System Access API (Chrome desktop only) | **Capacitor Filesystem** writing to `Downloads/logbook.md` |
| "Open logbook.md" button | **"Export logbook.md"** button — manual, on-demand |
| Auto-sync on every save | Save → SQLite only. Export writes the file when you tap the button |
| No export-date metadata | Export date is embedded in the markdown header, both human-readable and as `<!-- exportedAt:ISO --> ` for round-tripping |

The styling, layout, sliders, score arcs, custom date picker, search, sort, and edit/delete flows are preserved verbatim.

---

## Prerequisites

You need these once on your dev machine:

1. **Node.js 18+** — [nodejs.org](https://nodejs.org/)
2. **Android Studio** with the Android SDK — [developer.android.com/studio](https://developer.android.com/studio)
3. **JDK 17+** (Android Studio bundles one — setting `JAVA_HOME` to the bundled one works fine)

---

## Build steps

From this folder:

```bash
# 1. Install JS dependencies
npm install

# 2. Build the web bundle (Vite → dist/)
npm run build

# 3. Add the Android platform (creates the android/ folder)
npx cap add android

# 4. Generate launcher icons from assets/
npm run icons

# 5. Sync web assets + plugins into the Android project
npx cap sync android
```

After step 3, **apply the manifest edit below** before continuing to step 4.

Once everything's set up, open in Android Studio:

```bash
npx cap open android
```

Wait for Gradle sync, plug in your phone (with USB debugging on), and hit ▶ Run. Or build a sideload APK via **Build → Build APK(s)**.

---

## One required AndroidManifest edit

Open `android/app/src/main/AndroidManifest.xml` and add this `<uses-permission>` line inside `<manifest>`, alongside whatever Capacitor put there by default:

```xml
<uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"
                 tools:ignore="ScopedStorage" />
```

If the root `<manifest>` element doesn't already have `xmlns:tools="http://schemas.android.com/tools"`, add that too:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          xmlns:tools="http://schemas.android.com/tools"
          ...>
```

That's the only manifest edit needed — no legacy storage flag, no `WRITE_EXTERNAL_STORAGE` (deprecated past Android 11), no `READ_EXTERNAL_STORAGE` (deprecated past Android 13).

---

## One-time permission grant on your phone

The first time you run Export, Android will fail to write to `Downloads/` because `MANAGE_EXTERNAL_STORAGE` is a "special" permission that can't be requested via a normal popup. The toast will tell you the file went to app-private storage instead. To unlock the proper Downloads write:

1. Long-press the Travel Logbook icon → **App info**
2. **Permissions** → **All files access** → **Allow access to manage all files**
3. Tap Export again — it'll now write to `Downloads/logbook.md`

You only do this once.

---

## Customizing the app name

The launcher label "Travel Logbook" comes from `appName` in `capacitor.config.json`. Capacitor reads that **at the moment you run `npx cap add android`** and bakes it into `android/app/src/main/res/values/strings.xml` as `app_name`.

So:
- **First-time setup** — make sure `appName` is set before step 3 above. (It already is.)
- **Already added the Android platform with the wrong name?** Either delete `android/` and re-run `npx cap add android`, or just edit `android/app/src/main/res/values/strings.xml` and change the `<string name="app_name">` value directly. Same for `<string name="title_activity_main">`.

---

## Customizing the icon

The icon is designed as a **natively circular** globe — the design fills the full 100×100 viewBox, so when Android's launcher applies its circular mask the globe fills the entire visible area instead of getting reduced to the inscribed circle of a square.

Source files in `assets/`:

- `icon-source.svg` — the master source (a circular globe with a dotted flight-path trajectory and glowing amber destination, in the app's dark/amber/sage palette)
- `icon-foreground.png` (1024×1024) — full-size render of the SVG, transparent outside the globe; used as the adaptive-icon foreground
- `icon-background.png` (1024×1024) — solid `#0f0d0b` (the surface mid-tone from the design system); fills around the globe when launchers crop to non-circular shapes
- `icon-only.png` (1024×1024) — foreground composited over background; used by legacy non-adaptive launchers

**To regenerate the PNGs after editing the SVG**, run the helper script (requires Python with `cairosvg` and `Pillow`):

```bash
pip install --user cairosvg Pillow
python3 build_icons.py
```

Then `npm run icons` (which runs `npx capacitor-assets generate --android`) fans the three PNGs out into all the `mipmap-*` densities Android needs and copies them into the Android project.

To swap in a totally different design, replace `icon-source.svg` and re-run those two commands. Important details (trajectory, destination dot) should stay within roughly the central 70% of the SVG canvas — the launcher's mask crops the outer ~30% during animations, so anything near the edges might disappear at certain moments.

---

## Iterating on the app

After making changes to `index.html`, `src/*.js`, etc.:

```bash
npm run sync     # rebuilds + copies into android/
```

Then re-run from Android Studio.

For pure UI tweaks without a full APK rebuild, run in a desktop browser:

```bash
npm run dev      # localhost:5173
```

In dev mode, the data layer transparently falls back to `localStorage` and Export downloads via a normal browser download. Useful for quick iteration; the data does not transfer to/from the Android app.

---

## Project layout

```
travel-logbook-android/
├── index.html              # Original markup + CSS, with module script
├── src/
│   ├── main.js             # App logic (UI wiring, save/edit/delete flows)
│   ├── db.js               # SQLite (native) / localStorage (dev) abstraction
│   ├── exporter.js         # Markdown builder + Filesystem write
│   └── config.js           # Metric & category definitions (shared)
├── assets/
│   ├── icon-only.png       # Full-square launcher icon (1024×1024)
│   ├── icon-foreground.png # Adaptive icon foreground (1024×1024)
│   ├── icon-background.png # Adaptive icon background (1024×1024)
│   └── icon-source.svg     # Original SVG for regeneration
├── capacitor.config.json   # Capacitor app config (id, name, webDir)
├── vite.config.js          # Build config — outputs to dist/
├── package.json
└── README.md
└── android/                # Generated by `npx cap add android` (gitignored)
└── dist/                   # Generated by `npm run build` (gitignored)
```

---

## Troubleshooting

**"DB init failed" on launch** — make sure `npx cap sync android` was run after `npm install` so the SQLite plugin's native code is linked. If still failing, check `adb logcat` for plugin errors.

**Export saves to `/Android/data/com.travellogbook.app/files/` instead of Downloads** — `MANAGE_EXTERNAL_STORAGE` isn't granted yet. See "One-time permission grant" above.

**Gradle sync fails on first open** — usually a JDK mismatch. In Android Studio: **File → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK** → select JDK 17 (Android Studio's bundled one is fine).

**Icon didn't change after editing the SVG** — re-run `npm run icons`, then `npx cap sync android` (or just rebuild in Android Studio). The icons go into `android/app/src/main/res/mipmap-*/` and Android Studio sometimes caches the old version; "Build → Clean Project" fixes that.
