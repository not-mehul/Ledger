/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { worldPlaces } from 'dusk-dawn/places/vite';
import { defineConfig } from 'vite';
import { QUICK_MIN_RANK } from './src/lib/places-tiers';

export default defineConfig({
  // The world's towns, from the gazetteer Waymark shares (dusk-dawn, GeoNames
  // CC BY 4.0), as data/places.txt beside the page. Towns only: Ledger records
  // cities, and the landmarks would add a megabyte and a half to the app.
  // data/places-quick.txt holds the towns of 10,000 people or more (1.7 MB, not
  // 7.7), so city suggestions start at once while the whole list loads.
  plugins: [
    svelte(),
    worldPlaces({ fileName: 'data/places.txt', kinds: ['city'] }),
    worldPlaces({ fileName: 'data/places-quick.txt', kinds: ['city'], minRank: QUICK_MIN_RANK }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Keep in sync with android.minWebViewVersion in capacitor.config.ts.
    target: ['chrome111'],
  },
  server: {
    port: 5173,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
