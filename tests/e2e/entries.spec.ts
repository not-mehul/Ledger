import { expect, test } from '@playwright/test';
import { addEntry, openApp, pickCity, saveEntry } from './helpers';

test.beforeEach(async ({ page }) => openApp(page));

test('validates, saves, dedupes, edits and deletes entries', async ({ page }) => {
  await page.click('#btnSave');
  await expect(page.locator('#toast')).toHaveText('Please enter a city name.');

  await pickCity(page, 'Aust', 'Texas');
  await expect(page.locator('#inputState')).toHaveValue('Texas');
  await expect(page.locator('#scoreDisplay')).toHaveText('—');
  await page.locator('#sl-safety').fill('2');
  await expect(page.locator('#scoreDisplay')).toHaveText('46.6');
  await page.fill('#inputNotes', 'Tacos <b>everywhere</b>');
  await saveEntry(page);
  await expect(page.locator('#toast')).toHaveText('Saved: Austin, Texas — 46.6/100');
  await expect(page.locator('#entryBadge')).toHaveText('1');

  // Same city and month again updates rather than duplicates.
  await page.fill('#inputCity', 'austin');
  await page.fill('#inputState', 'TEXAS');
  await saveEntry(page);
  await expect(page.locator('#entryBadge')).toHaveText('1');

  await page.click('#tabLogbook');
  await page.click('.entry-card-header');
  await page.click('[data-action="edit"]');
  await expect(page.locator('#inputCity')).toHaveValue('austin');
  await expect(page.locator('#btnSave')).toHaveText('Update Entry');
  await page.fill('#inputNotes', 'Edited');
  await saveEntry(page);

  await page.reload();
  await page.click('#tabLogbook');
  await page.click('.entry-card-header');
  await expect(page.locator('.entry-notes-text')).toHaveText('Edited');
  await page.click('[data-action="delete"]');
  await expect(page.locator('.empty-title')).toHaveText('No cities logged yet.');
});

test('searches and sorts the ledger', async ({ page }) => {
  await addEntry(page, 'Lisbon', 'Portugal', { foodQuality: 10 });
  await addEntry(page, 'Kyoto', 'Japan', { safety: 1 });
  await page.click('#tabLogbook');
  const names = page.locator('.entry-city-name');
  await page.click('[data-sort="score"]');
  await expect(names.first()).toContainText('Lisbon');
  await page.click('[data-sort="city"]');
  await expect(names.first()).toContainText('Kyoto');
  await page.fill('#searchLogbook', 'portugal');
  await expect(names).toHaveCount(1);
  await page.fill('#searchLogbook', 'zzz');
  await expect(page.locator('.empty-title')).toHaveText('No matches found.');
});
