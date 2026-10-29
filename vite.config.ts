/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Keep in sync with android.minWebViewVersion in capacitor.config.ts.
    target: 'chrome108',
  },
  server: {
    port: 5173,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
