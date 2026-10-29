import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.notmehul.ledger',
  appName: 'Ledger',
  webDir: 'dist',
  // WebView background before the page paints; matches the app's surface colour.
  backgroundColor: '#0f0d0b',
  android: {
    allowMixedContent: false,
    // Android System WebView updates through the Play Store; 108 (late 2022)
    // covers 100dvh, crypto.randomUUID and the rest of what the UI uses.
    minWebViewVersion: 108,
  },
  plugins: {
    SystemBars: {
      // index.html opts into edge-to-edge with viewport-fit=cover; the CSS
      // pads the layout with env(safe-area-inset-*).
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
};

export default config;
