// Feature review, Phase A: skip a metric, keep a draft, filter the ledger,
// export a spreadsheet.
import { expect, test } from '@playwright/test';
import { importPlaces, openApp, saveEntry } from './helpers';

test('a skipped metric is left out of the score and the entry', async ({ page }) => {
  await openApp(page);
  await page.fill('#inputCity', 'Lisbon');
  await page.fill('#inputState', 'Portugal');
  // Everything at 10 scores 100; skipping one keeps it at 100 rather than pulling it to the default.
  for (const id of await page.locator('#viewNew .metric-slider').evaluateAll((els) => els.map((e) => e.id)))
    await page.locator(`#${id}`).fill('10');
  await expect(page.locator('#scoreDisplay')).toHaveText('100.0');
  await page.getByRole('button', { name: 'Skip Internet Speed' }).click();
  await expect(page.locator('#disp-internet')).toHaveText('Not rated');
  await expect(page.locator('#scoreDisplay')).toHaveText('100.0');
  // An untouched slider counts as 5; skipping it takes that 5 away.
  await page.locator('#sl-safety').fill('10');
  await page.getByRole('button', { name: 'Skip Safety' }).click();
  await expect(page.getByRole('button', { name: 'Skip Safety' })).toHaveCount(0);
  // Moving a skipped slider rates it again.
  await page.locator('#sl-safety').fill('1');
  await expect(page.locator('#disp-safety')).toHaveText('1/10');
  await expect(page.locator('#scoreDisplay')).not.toHaveText('100.0');
  await page.getByRole('button', { name: 'Skip Safety' }).click();
  // Not quite perfect, so the save is an ordinary one.
  await page.locator('#sl-returnDesire').fill('9');
  await saveEntry(page);

  // Saved without them, and editing can take a rating off too.
  await page.click('#tabLogbook');
  await page.locator('.entry-card-header').first().click();
  await expect(page.locator('.entry-card.open')).not.toContainText('Internet Speed');
  await page.locator('.entry-card.open [data-action="edit"]').click();
  await expect(page.locator('#disp-internet')).toHaveText('Not rated');
  await page.getByRole('button', { name: 'Skip Greenery & Nature Access' }).click();
  await page.click('#btnSave');
  await expect(page.locator('#toast')).toContainText('Updated');
  await page.click('#tabLogbook');
  await page.locator('.entry-card-header').first().click();
  await expect(page.locator('.entry-card.open')).not.toContainText('Greenery');
});

test('an unsaved entry comes back after the app restarts, and goes once saved', async ({ page }) => {
  await openApp(page);
  await page.fill('#inputCity', 'Porto');
  await page.fill('#inputState', 'Portugal');
  await page.locator('#sl-foodQuality').fill('9');
  await page.getByRole('button', { name: 'Skip Internet Speed' }).click();
  await page.fill('#inputNotes', 'Francesinha.');
  await page.reload();
  await expect(page.locator('#fileStatus.connected')).toBeVisible();
  await expect(page.locator('#toast')).toHaveText('Your unsaved entry is back.');
  await expect(page.locator('#inputCity')).toHaveValue('Porto');
  await expect(page.locator('#inputState')).toHaveValue('Portugal');
  await expect(page.locator('#disp-foodQuality')).toHaveText('9/10');
  await expect(page.locator('#disp-internet')).toHaveText('Not rated');
  await expect(page.locator('#inputNotes')).toHaveValue('Francesinha.');
  await saveEntry(page);
  await page.reload();
  await expect(page.locator('#fileStatus.connected')).toBeVisible();
  await expect(page.locator('#inputCity')).toHaveValue('');
  await expect(page.locator('#toast', { hasText: 'Your unsaved entry is back.' })).toHaveCount(0);
});

test('filters by country, year and tier, and search finds a country by name', async ({ page }, info) => {
  await openApp(page);
  await importPlaces(page, info.outputPath('seed.json'), [
    ['Austin', 'Texas', 'US', 30.27, -97.74],
    ['Boise', 'Idaho', 'US', 43.6, -116.2],
    ['Kyoto', 'Japan', 'JP', 35.01, 135.77],
  ]);
  await page.click('#tabLogbook');
  const cards = page.locator('.entry-card');
  await expect(cards).toHaveCount(3);

  // "United States" finds the Texas and Idaho entries.
  await page.fill('#searchLogbook', 'united states');
  await expect(cards).toHaveCount(2);
  await expect(page.locator('#logbookCount')).toHaveText('2 of 3');
  await page.fill('#searchLogbook', '');

  // Filters fold away until asked for.
  await expect(page.locator('#filterRow')).toHaveCount(0);
  await page.click('#btnFilter');
  await page.locator('#filterCountry').click();
  await page.locator('.dd-option', { hasText: 'Japan' }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Kyoto');
  await expect(page.locator('#btnFilter')).toHaveAttribute('aria-label', 'Filters on');
  // Filtering keeps the row open even when toggled.
  await page.click('#btnFilter');
  await expect(page.locator('#filterRow')).toBeVisible();

  // Nothing matches: clear everything in one tap.
  await page.locator('#filterTier').click();
  await page.locator('.dd-option', { hasText: 'Exceptional' }).click();
  await expect(page.locator('#noMatch')).toHaveText('Nothing in your ledger matches these filters.');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(cards).toHaveCount(3);
});
