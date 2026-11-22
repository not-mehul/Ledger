// Layout and touch-target guards from the November 2026 UI review (Phase 1).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { addEntry, openApp } from './helpers';

const box = async (l: Locator) => (await l.boundingBox())!;
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function seed(page: Page, info: import('@playwright/test').TestInfo, n = 3) {
  const places = [
    ['Lisbon', 'Portugal', 'PT', 38.72, -9.14],
    ['Kyoto', 'Japan', 'JP', 35.01, 135.77],
    ['Austin', 'Texas', 'US', 30.27, -97.74],
  ] as const;
  const entries = places.slice(0, n).map(([city, state, country, lat, lon], i) => ({
    id: `e${i}`, city, state, country, lat, lon, date: `2025-0${i + 1}`, ratings: { greenery: 7 + i }, notes: '', savedAt: '2025-01-01T00:00:00Z',
  }));
  const file = info.outputPath('seed.json');
  await writeFile(file, JSON.stringify({ schemaVersion: 2, entries }));
  await page.click('#tabSettings');
  await page.setInputFiles('#importFile', file);
  await expect(page.locator('#toast')).toContainText('Import complete');
}

for (const width of [360, 412]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: 740 } });

    test('the sort buttons stay on one row, inside the screen', async ({ page }, info) => {
      await openApp(page);
      await seed(page, info);
      await page.click('#tabLogbook');
      const buttons = page.locator('.sort-row [role="radio"]');
      const tops = await Promise.all((await buttons.all()).map(async (b) => Math.round((await box(b)).y)));
      expect(new Set(tops).size).toBe(1);
      const row = await box(page.locator('.sort-row'));
      expect(row.x + row.width).toBeLessThanOrEqual(width);
      await expect(page.getByRole('radio', { name: 'Alphabetical' })).toHaveText('A–Z');
    });

    test('the compare tray never overlaps itself', async ({ page }, info) => {
      await openApp(page);
      await seed(page, info);
      await page.click('#tabLogbook');
      await page.locator('.entry-card-header').first().click();
      await page.click('[data-action="compare"]');
      const tray = page.locator('#compareTray');
      const chip = await box(tray.locator('.tray-chip').first());
      for (const button of await tray.locator('.tray-actions .btn').all()) expect(overlaps(chip, await box(button))).toBe(false);
      const t = await box(tray);
      expect(t.x + t.width).toBeLessThanOrEqual(width);
    });
  });
}

test('a toast raised under an open sheet sits above it', async ({ page }) => {
  await openApp(page);
  await addEntry(page, 'Oslo', 'Norway');
  await page.click('#btnExport');
  await expect(page.locator('dialog.sheet')).toBeVisible();
  await page.waitForTimeout(600); // the sheet's entrance
  const toast = await box(page.locator('.toast'));
  const sheet = await box(page.locator('dialog.sheet'));
  expect(toast.y + toast.height).toBeLessThanOrEqual(sheet.y);
  // Closing the sheet lets the toast settle back down.
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.sheet')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.getPropertyValue('--toast-lift'))).toBe('');
});

test('a toast stays above the compare tray', async ({ page }, info) => {
  await openApp(page);
  await seed(page, info);
  await page.click('#tabLogbook');
  await page.locator('.entry-card-header').first().click();
  await page.click('[data-action="compare"]');
  await page.locator('.entry-card-header').nth(1).click();
  await page.locator('.entry-card').nth(1).locator('[data-action="delete"]').click();
  await expect(page.locator('#toast')).toContainText('deleted');
  expect(overlaps(await box(page.locator('.toast')), await box(page.locator('#compareTray')))).toBe(false);
});

test('the ledger heading counts only while searching', async ({ page }, info) => {
  await openApp(page);
  await seed(page, info);
  await page.click('#tabLogbook');
  await expect(page.locator('#logbookCount')).toHaveText('');
  await page.fill('#searchLogbook', 'kyo');
  await expect(page.locator('#logbookCount')).toHaveText('1 of 3');
});

test('the credit line lives in About, not under Save', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#viewNew')).not.toContainText('Designed by Mehul');
  await page.click('#tabSettings');
  await expect(page.locator('#aboutVersion')).toContainText('Designed by Mehul');
});

test('map pins have 44 px touch targets, and the zoom buttons sit below the map', async ({ page }, info) => {
  await openApp(page);
  await seed(page, info);
  await page.click('#tabMap');
  const pin = page.locator('.pin').first();
  await expect(pin).toBeVisible();
  const target = await box(pin.locator('.hit'));
  expect(Math.round(target.width)).toBeGreaterThanOrEqual(44);
  const frame = await box(page.locator('.map-frame'));
  const zoom = await box(page.locator('.map-controls'));
  expect(zoom.y).toBeGreaterThanOrEqual(frame.y + frame.height);
  // Keyboard: Space opens a pin as Enter does.
  await page.locator('.pin[aria-label="Kyoto, Japan"]').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.map-selected')).toContainText('Kyoto');
});
