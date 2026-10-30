import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { openApp } from './helpers';

const BASE = {
  greenery: 5, airQuality: 5, temperature: 5, visualBeauty: 5, cleanliness: 5, walkability: 5,
  foodQuality: 5, foodAffordability: 5, safety: 5, friendliness: 5, internet: 5, returnDesire: 5,
};

// Return Desire follows Food Quality and runs against Internet Speed.
const CITIES: [string, string, string, number, number, string, Partial<typeof BASE>][] = [
  ['Lisbon', 'Portugal', 'PT', 38.72, -9.14, '2025-04', { foodQuality: 9, returnDesire: 9, internet: 4 }],
  ['Kyoto', 'Japan', 'JP', 35.01, 135.77, '2025-10', { foodQuality: 10, returnDesire: 10, internet: 5, safety: 10 }],
  ['Austin', 'Texas', 'US', 30.27, -97.74, '2025-02', { foodQuality: 7, returnDesire: 6, internet: 9 }],
  ['Berlin', 'Germany', 'DE', 52.52, 13.4, '2024-09', { foodQuality: 6, returnDesire: 6, internet: 7 }],
  ['Dubai', 'United Arab Emirates', 'AE', 25.2, 55.27, '2024-12', { foodQuality: 4, returnDesire: 3, internet: 10 }],
  ['Bangkok', 'Thailand', 'TH', 13.75, 100.5, '2024-03', { foodQuality: 9, returnDesire: 8, internet: 6 }],
];

async function importCities(page: Page, info: TestInfo, count = CITIES.length) {
  const entries = CITIES.slice(0, count).map(([city, state, country, lat, lon, date, r], i) => ({
    id: `e${i}`, city, state, country, lat, lon, date, notes: '', photos: [],
    savedAt: '2025-11-01T00:00:00.000Z', ratings: { ...BASE, ...r },
  }));
  const file = info.outputPath('ledger.json');
  await writeFile(file, JSON.stringify({ app: 'ledger', schemaVersion: 2, entries }));
  await page.click('#tabSettings');
  await page.setInputFiles('#importFile', file);
  await expect(page.locator('#toast')).toContainText('Import complete');
  await page.click('#tabInsights');
}

test.beforeEach(async ({ page }) => openApp(page));

test('shows an empty state with no entries', async ({ page }) => {
  await page.click('#tabInsights');
  await expect(page.locator('#viewInsights .empty-title')).toHaveText('Log a few cities to see insights here.');
});

test('summarises each year and all time', async ({ page }, info) => {
  await importCities(page, info);
  await expect(page.locator('.period button')).toHaveText(['2025', '2024', 'All time']);
  await expect(page.locator('#reviewHeading')).toHaveText('2025 in Ledger');
  await expect(page.locator('[data-stat="cities"] dd')).toHaveText('3');
  await expect(page.locator('[data-stat="countries"] dd')).toHaveText('3');
  await expect(page.locator('.highlight').first()).toContainText('Kyoto, Japan');

  await page.click('[data-year="all"]');
  await expect(page.locator('#reviewHeading')).toHaveText('My Ledger so far');
  await expect(page.locator('[data-stat="cities"] dd')).toHaveText('6');
  await expect(page.locator('.countries')).toContainText('Thailand');

  // Highlights open the entry in the ledger.
  await page.locator('.highlight').first().click();
  await expect(page.locator('.entry-card.open .entry-city-name')).toContainText('Kyoto');

  await page.click('#tabInsights');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#shareReview')]);
  expect(download.suggestedFilename()).toBe('ledger-2025-review.png');
  expect((await readFile(await download.path())).subarray(1, 4).toString()).toBe('PNG');
});

test('ranks cities by score, category or metric', async ({ page }, info) => {
  await importCities(page, info);
  await page.click('[data-year="all"]');
  const cities = page.locator('#rankingList .city');
  await expect(cities.first()).toHaveText('Kyoto');
  await page.selectOption('#rankBy', 'metric:internet');
  await expect(cities).toHaveText(['Dubai', 'Austin', 'Berlin', 'Bangkok', 'Kyoto', 'Lisbon']);
  await page.selectOption('#rankBy', 'category:people');
  await expect(cities.first()).toHaveText('Kyoto');
  // A year filter narrows the list.
  await page.click('[data-year="2024"]');
  await expect(cities).toHaveCount(3);
});

test('explains what drives a verdict and applies suggested weights', async ({ page }, info) => {
  await importCities(page, info, 4);
  await expect(page.locator('#valueNeed')).toContainText('Rate at least 5 cities');

  await importCities(page, info);
  await expect(page.locator('#valueStrongest')).toHaveText('Food Quality tracks your Return Desire most closely.');
  await expect(page.locator('#valueMismatch')).toContainText('Internet Speed ×2');

  await page.click('#applyWeights');
  await expect(page.locator('#toast')).toHaveText('Weights updated.');
  await expect(page.locator('#valueSignals tr[data-metric="foodQuality"] .w')).toHaveText('×5');

  // The new weights are what Settings → Metrics shows.
  await page.click('#tabSettings');
  await page.click('#metricsEditor summary');
  await expect(page.locator('[data-metric="foodQuality"] select').first()).toHaveValue('5');
  await expect(page.locator('[data-metric="internet"] select').first()).toHaveValue('0.5');
});
