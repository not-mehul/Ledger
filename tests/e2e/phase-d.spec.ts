// Feature review, Phase D: a city across its visits, rankings by city, a
// home city to compare with, and world stats under the map.
import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { openApp } from './helpers';

const all = (v: number) => ({ greenery: v, safety: v, foodQuality: v, returnDesire: v });
const ENTRIES = [
  { id: 'a1', city: 'Austin', state: 'Texas', country: 'US', lat: 30.27, lon: -97.74, date: '2023-03', ratings: all(10), notes: 'Tacos.' },
  { id: 'a2', city: 'Austin', state: 'Texas', country: 'US', lat: 30.27, lon: -97.74, date: '2025-03', ratings: all(4), notes: 'Too hot.' },
  { id: 'k', city: 'Kyoto', state: 'Japan', country: 'JP', lat: 35.01, lon: 135.77, date: '2024-04', ratings: all(8), notes: '' },
  { id: 'l', city: 'Lisbon', state: 'Portugal', country: 'PT', lat: 38.72, lon: -9.14, date: '2024-05', ratings: all(6), notes: '' },
];

async function seed(page: Page, file: string) {
  await writeFile(file, JSON.stringify({ schemaVersion: 2, entries: ENTRIES.map((e) => ({ ...e, savedAt: '2025-01-01T00:00:00Z' })) }));
  await page.click('#tabSettings');
  await page.setInputFiles('#importFile', file);
  await expect(page.locator('#toast')).toContainText('Import complete');
}

test('rankings can rank each city once, averaged over its visits', async ({ page }, info) => {
  await openApp(page);
  await seed(page, info.outputPath('seed.json'));
  await page.click('#settingsBack');
  await page.click('#tabInsights');
  await page.click('.period [data-year="all"]');
  const rows = page.locator('#rankingList li');
  await expect(rows).toHaveCount(4);
  await page.click('.rank-per [data-per="city"]');
  await expect(rows).toHaveCount(3);
  // Austin's 100 and 33.3 average 66.7, between Kyoto (77.8) and Lisbon (55.6).
  await expect(rows.nth(1)).toContainText('Austin');
  await expect(rows.nth(1)).toContainText('2 visits');
  await expect(rows.nth(1).locator('.val')).toHaveText('66.7');
});

test('a home city puts "vs home" on every other card', async ({ page }, info) => {
  await openApp(page);
  await seed(page, info.outputPath('seed.json'));
  await expect(page.locator('#homeCity')).toContainText('Set one to see how every city compares with home');
  await page.click('#homeCity');
  await page.locator('#homeList .settings-row', { hasText: 'Lisbon' }).click();
  await expect(page.locator('#homeCity')).toContainText('Lisbon, Portugal');
  await page.click('#settingsBack');
  await page.click('#tabLogbook');

  await page.locator('#card-k .entry-card-header').click();
  const tile = page.locator('#card-k [data-context="home"]');
  await expect(tile).toContainText('+22.2');
  await expect(tile).toContainText('against Lisbon');
  // Home's own card says so, with no tile.
  await expect(page.locator('#card-l .entry-meta')).toContainText('Home');
  await page.locator('#card-l .entry-card-header').click();
  await expect(page.locator('#card-l [data-context="home"]')).toHaveCount(0);

  // And it can be cleared.
  await page.click('#tabSettings');
  await page.click('#homeCity');
  await page.locator('#homeList .settings-row', { hasText: 'No home city' }).click();
  await expect(page.locator('#homeCity')).not.toContainText('Lisbon');
});

test('All about a city shows its visits together', async ({ page }, info) => {
  await openApp(page);
  await seed(page, info.outputPath('seed.json'));
  await page.click('#settingsBack');
  await page.click('#tabLogbook');
  await page.locator('#card-a2 .entry-card-header').click();
  await page.locator('#card-a2 [data-action="city"]').click();
  const view = page.locator('[data-testid="city-view"]');
  await expect(view).toContainText('Visits');
  await expect(view.locator('.tile').nth(0)).toContainText('2');
  await expect(view.locator('.tile').nth(1)).toContainText('66.7');
  await expect(view.locator('.tile').nth(2)).toContainText('−66.7');
  await expect(view).toContainText('Tacos.');
  await expect(view).toContainText('Too hot.');
  // Opening the older visit goes to its card.
  await view.locator('.settings-row', { hasText: 'Tacos.' }).click();
  await expect(page.locator('[data-testid="city-view"]')).toHaveCount(0);
  await expect(page.locator('#card-a1.open')).toBeVisible();
});

test('the map counts countries and continents', async ({ page }, info) => {
  await openApp(page);
  await seed(page, info.outputPath('seed.json'));
  await page.click('#settingsBack');
  await page.click('#tabMap');
  const stats = page.locator('#worldStats');
  await expect(stats).toContainText('3 of 195');
  await expect(stats).toContainText('2% of the world');
  await expect(stats).toContainText('3 of 6');
  await expect(stats).toContainText('Asia 1 · Europe 1 · North America 1');
});
