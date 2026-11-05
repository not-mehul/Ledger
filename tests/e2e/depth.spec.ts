import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { openApp } from './helpers';

const BASE = {
  greenery: 5, airQuality: 5, temperature: 5, visualBeauty: 5, cleanliness: 5, walkability: 5,
  foodQuality: 5, foodAffordability: 5, safety: 5, friendliness: 5, internet: 5, returnDesire: 5,
};

const ENTRIES = [
  { id: 'lis1', city: 'Lisbon', state: 'Portugal', country: 'PT', date: '2024-11', notes: 'Rain on the trams, custard tarts by the window.', r: { foodQuality: 7, returnDesire: 7 } },
  { id: 'lis2', city: 'Lisbon', state: 'Portugal', country: 'PT', date: '2025-06', notes: '', r: { foodQuality: 9, returnDesire: 9, safety: 8 } },
  { id: 'kyo', city: 'Kyoto', state: 'Japan', country: 'JP', date: '2025-10', notes: '', r: { foodQuality: 10, safety: 10, internet: 8, returnDesire: 10 } },
  { id: 'dxb', city: 'Dubai', state: 'United Arab Emirates', country: 'AE', date: '2025-02', notes: '', r: { foodQuality: 4, internet: 10, returnDesire: 3 } },
];

async function importLedger(page: Page, info: TestInfo) {
  const entries = ENTRIES.map(({ r, ...e }) => ({ ...e, photos: [], savedAt: '2025-11-01T00:00:00.000Z', ratings: { ...BASE, ...r } }));
  const file = info.outputPath('ledger.json');
  await writeFile(file, JSON.stringify({ app: 'ledger', schemaVersion: 2, entries }));
  await page.click('#tabSettings');
  await page.setInputFiles('#importFile', file);
  await expect(page.locator('#toast')).toContainText('Import complete');
}

test('the form ranks a score live, averages each category and offers a past visit', async ({ page }, info) => {
  await openApp(page);
  await importLedger(page, info);
  await page.click('#tabNew');

  await page.fill('#inputCity', 'Lisbon');
  await page.fill('#inputState', 'Portugal');
  await expect(page.locator('#returningNotice')).toContainText("You've been to Lisbon before");
  await expect(page.locator('#returningNotice')).toContainText('June 2025');
  await page.click('#returningNotice');
  await expect(page.locator('#returningNotice')).toBeHidden();
  await expect(page.locator('#sl-foodQuality')).toHaveValue('9');
  await expect(page.locator('#scorePlacing')).toHaveText(/Ranks #\d of 5 in your ledger/);
  await expect(page.locator('.cat-avg[data-cat="food"]')).toHaveText('7.0');

  await page.locator('#sl-foodQuality').fill('3');
  await expect(page.locator('.cat-avg[data-cat="food"]')).toHaveText('4.0');
});

test('cards place a visit in context and compare cities side by side', async ({ page }, info) => {
  await openApp(page);
  await importLedger(page, info);
  await page.click('#tabLogbook');

  await expect(page.locator('.year-group')).toHaveCount(2);
  await expect(page.locator('.year-group').first()).toContainText('2025');
  await expect(page.locator('.year-group').first()).toContainText('3 cities');

  const lisbon = page.locator('#card-lis2');
  await expect(lisbon.locator('.entry-meta')).toContainText('visit 2');
  await lisbon.locator('.entry-card-header').click();
  await expect(lisbon.locator('[data-context="rank"]')).toContainText('#2 of 4');
  await expect(lisbon.locator('[data-context="best"]')).toContainText('Stands out');
  await expect(lisbon.locator('[data-testid="visit-history"] .visit-row')).toHaveCount(2);
  await expect(lisbon.locator('.visit-change.up')).toBeVisible();
  await expect(lisbon.locator('.usual-tick').first()).toBeAttached();

  // Jump to the earlier visit.
  await lisbon.locator('.visit-row:not(.current)').click();
  await expect(page.locator('#card-lis1.open')).toBeVisible();

  // Compare Lisbon with Kyoto.
  await lisbon.locator('[data-action="compare"]').click();
  await expect(page.locator('#compareTray')).toContainText('Pick one more city');
  await expect(page.locator('#btnCompare')).toBeDisabled();
  await page.locator('#card-kyo .entry-card-header').click();
  await page.locator('#card-kyo [data-action="compare"]').click();
  await page.click('#btnCompare');
  await expect(page.locator('#compareView .cmp-city')).toHaveText(['Lisbon', 'Kyoto']);
  await expect(page.locator('#compareVerdict')).toContainText('Kyoto comes out ahead by');
  await expect(page.locator('[data-metric="internet"] .cmp-cell.lead')).toHaveCount(1);
  await page.locator('.sheet .btn-muted', { hasText: 'Close' }).click();
  await page.click('#compareTray .btn-muted');
  await expect(page.locator('#compareTray')).toBeHidden();
});

test('the ledger remembers this month in earlier years', async ({ page }, info) => {
  await page.clock.install({ time: new Date('2026-11-05T10:00:00') });
  await openApp(page);
  await importLedger(page, info);
  await page.click('#tabLogbook');
  await expect(page.locator('#memoryNotice')).toContainText('In November 2024 you were in Lisbon');
  await expect(page.locator('#memoryNotice')).toContainText('custard tarts');
  await page.click('#memoryNotice');
  await expect(page.locator('#card-lis1.open')).toBeVisible();
});

test('insights chart scores over time, the tier spread and rating habits', async ({ page }, info) => {
  await openApp(page);
  await importLedger(page, info);
  await page.click('#tabInsights');
  await page.click('[data-year="all"]');
  await expect(page.locator('#patterns .dot')).toHaveCount(4);
  await expect(page.locator('#tierSpread li')).toHaveCount(5);
  await expect(page.locator('#ratingHabits [data-habit="generous"]')).toContainText('Food Quality');
  await page.locator('#patterns .dot').last().click();
  await expect(page.locator('.entry-card.open .entry-city-name')).toContainText('Kyoto');
});
