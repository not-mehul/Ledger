import { expect, type Page } from '@playwright/test';

/** Opens the app with an empty ledger and fails the test on any page error. */
export async function openApp(page: Page): Promise<void> {
  page.on('pageerror', (err) => {
    throw err;
  });
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await expect(page.locator('#fileStatus.connected')).toBeVisible();
}

/** Types a city and picks the first suggestion whose details contain `where`. */
export async function pickCity(page: Page, query: string, where: string): Promise<void> {
  await page.fill('#inputCity', query);
  await page.locator('#citySuggestions li', { hasText: where }).first().dispatchEvent('pointerdown');
}

export async function saveEntry(page: Page): Promise<void> {
  await page.click('#btnSave');
  await expect(page.locator('#toast')).toContainText(/Saved|Updated/);
}

export async function addEntry(page: Page, city: string, region: string, ratings: Record<string, number> = {}): Promise<void> {
  await page.click('#tabNew');
  await page.fill('#inputCity', city);
  await page.fill('#inputState', region);
  for (const [id, value] of Object.entries(ratings)) await page.locator(`#sl-${id}`).fill(String(value));
  await saveEntry(page);
}

/**
 * The newest file the app saved under a Capacitor directory, e.g.
 * savedFile(page, 'DOCUMENTS/Ledger', /\.md$/). In the test build
 * @capacitor/filesystem keeps files in IndexedDB; text is stored as written,
 * binary files as base64.
 */
export async function savedFile(page: Page, folder: string, name: RegExp, binary = false): Promise<{ name: string; data: Buffer }> {
  let found: { path: string; content: string } | null = null;
  await expect
    .poll(async () => {
      found = await page.evaluate(
        async ({ prefix, source, flags }) => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open('Disc');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          const all = await new Promise<{ path: string; type: string; mtime: number; content: string }[]>((resolve, reject) => {
            const req = db.transaction('FileStorage').objectStore('FileStorage').getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          db.close();
          const re = new RegExp(source, flags);
          const files = all
            .filter((f) => f.type === 'file' && f.path.startsWith(prefix) && re.test(f.path.slice(prefix.length)))
            .sort((a, b) => b.mtime - a.mtime);
          return files[0] ? { path: files[0].path, content: files[0].content } : null;
        },
        { prefix: `/${folder}/`, source: name.source, flags: name.flags },
      );
      return found !== null;
    })
    .toBe(true);
  const { path, content } = found!;
  return { name: path.split('/').pop()!, data: binary ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8') };
}

/** Settings → Metrics: opens the editor's sheet. */
export async function openMetrics(page: Page): Promise<void> {
  await page.click('#tabSettings');
  await page.click('#metricsEditor');
  await expect(page.locator('dialog.sheet .metric-row').first()).toBeVisible();
  await sheetSettled(page);
}

/** Waits for every open sheet to finish rising, so positions read are final. */
export async function sheetSettled(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('dialog.sheet[open]')].every((d) => d.getAnimations().every((a) => a.playState !== 'running')),
  );
}

/** Closes the topmost sheet the way Android back would. */
export async function closeSheet(page: Page): Promise<void> {
  const open = page.locator('dialog.sheet[open]');
  const before = await open.count();
  await page.keyboard.press('Escape');
  await expect(open).toHaveCount(before - 1);
}

type SeedPlace = readonly [city: string, state: string, country: string, lat: number, lon: number];

/** Imports these places as entries through Settings, then returns to the tabs. */
export async function importPlaces(page: Page, file: string, places: readonly SeedPlace[]): Promise<void> {
  const entries = places.map(([city, state, country, lat, lon], i) => ({
    id: `p${i}`, city, state, country, lat, lon, date: `2025-0${(i % 9) + 1}`, notes: '', savedAt: '2025-01-01T00:00:00Z',
    // Varied, so Insights has links to show.
    ratings: { greenery: 7, safety: (i * 3) % 10, internet: (i * 7) % 10, foodQuality: 9 - i, returnDesire: (i * 5) % 10 },
  }));
  const { writeFile } = await import('node:fs/promises');
  await writeFile(file, JSON.stringify({ schemaVersion: 2, entries }));
  await page.click('#tabSettings');
  await page.setInputFiles('#importFile', file);
  await expect(page.locator('#toast')).toContainText('Import complete');
  await page.click('#settingsBack');
}
