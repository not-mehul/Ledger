/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { worldPlaces } from 'dusk-dawn/places/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // The world's towns, from the gazetteer Waymark shares (dusk-dawn, GeoNames
  // CC BY 4.0), as data/places.txt beside the page. Towns only: Ledger records
  // cities, and the landmarks would add a megabyte and a half to the app.
  plugins: [svelte(), worldPlaces({ fileName: 'data/places.txt', kinds: ['city'] })],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Keep in sync with android.minWebViewVersion in capacitor.config.ts.
    target: ['chrome111', 'safari16'],
  },
  server: {
    port: 5173,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
