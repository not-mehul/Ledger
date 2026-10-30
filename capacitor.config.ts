import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.notmehul.ledger',
  appName: 'Ledger',
  webDir: 'dist',
  // WebView background before the page paints; matches the app's surface colour.
  backgroundColor: '#0f0d0b',
  android: {
    allowMixedContent: false,
    // Android System WebView updates through the Play Store; 111 (early 2023)
    // covers OffscreenCanvas.convertToBlob, 100dvh, crypto.randomUUID and
    // the rest of what the UI uses.
    minWebViewVersion: 111,
  },
  plugins: {
    SystemBars: {
      // index.html opts into edge-to-edge with viewport-fit=cover; the CSS
      // pads the layout with env(safe-area-inset-*).
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      // Follow the system until src/platform/theme.ts applies the user's theme.
      style: 'DEFAULT',
    },
  },
};

export default config;
