// Regression tests for the November 2026 audit, in the real UI.
import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { addEntry, openApp, saveEntry, savedFile } from './helpers';

test.beforeEach(async ({ page }) => openApp(page));

async function scoreOf(page: Page, city: string): Promise<string> {
  await page.click('#tabLogbook');
  return (await page.locator('.entry-card', { hasText: city }).locator('.score-dial').first().getAttribute('aria-label')) ?? '';
}

test('H2: editing an older entry leaves metrics added since unrated', async ({ page }) => {
  await addEntry(page, 'Lisbon', 'Portugal', { greenery: 9, safety: 9, internet: 9, returnDesire: 9, foodQuality: 9 });
  const before = await scoreOf(page, 'Lisbon');

  await page.click('#tabSettings');
  await page.click('#metricsEditor summary');
  await page.locator('fieldset.cat-edit').nth(2).getByRole('button', { name: '+ Add metric' }).click();

  await page.click('#settingsBack');
  await page.click('#tabLogbook');
  await page.locator('.entry-card-header').first().click();
  await page.click('[data-action="edit"]');
  const added = page.locator('#viewNew .metric-item').filter({ hasText: 'New metric' });
  await expect(added.locator('.metric-val')).toHaveText('Not rated');
  await page.fill('#inputNotes', 'typo fix');
  await saveEntry(page);
  expect(await scoreOf(page, 'Lisbon')).toBe(before);

  // Moving the new slider does rate it.
  await page.locator('.entry-card-header').first().click();
  await page.click('[data-action="edit"]');
  await added.locator('input[type="range"]').fill('2');
  await expect(added.locator('.metric-val')).toHaveText('2/10');
  await saveEntry(page);
  expect(await scoreOf(page, 'Lisbon')).not.toBe(before);
});

test('H3: a repeat visit offers the logged entry and never loses its notes', async ({ page }) => {
  await page.fill('#inputCity', 'Kyoto');
  await page.fill('#inputState', 'Japan');
  await page.fill('#inputNotes', 'Long, irreplaceable notes about the temples.');
  await saveEntry(page);

  // Cancelling the question changes nothing.
  await page.fill('#inputCity', 'Kyoto');
  await page.fill('#inputState', 'Japan');
  await page.locator('#sl-safety').fill('3');
  await page.click('#btnSave');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#inputCity')).toHaveValue('Kyoto');

  // Confirming keeps the old notes and adds only what was changed.
  await page.fill('#inputNotes', 'Second look.');
  await page.click('#btnSave');
  await page.click('#confirmAction');
  await expect(page.locator('#toast')).toContainText('Updated');
  await page.click('#tabLogbook');
  await expect(page.locator('.entry-card')).toHaveCount(1);
  await page.locator('.entry-card-header').first().click();
  await expect(page.locator('.entry-notes-text')).toContainText('irreplaceable');
  await expect(page.locator('.entry-notes-text')).toContainText('Second look.');

  // The notice opens the logged entry instead.
  await page.click('#tabNew');
  await page.fill('#inputCity', 'Kyoto');
  await page.fill('#inputState', 'Japan');
  await page.click('#sameVisitNotice');
  await expect(page.locator('#btnSave')).toHaveText('Update Entry');
  await expect(page.locator('#inputNotes')).toHaveValue(/irreplaceable/);
});

test('L11: an edit can’t turn one entry into a copy of another visit', async ({ page }) => {
  await addEntry(page, 'Oslo', 'Norway');
  await page.locator('#inputDate').click();
  await page.click('#dpPrevYear');
  await page.locator('#dpGrid [data-month="0"]').click();
  await page.click('#dpChoose');
  await page.fill('#inputCity', 'Oslo');
  await page.fill('#inputState', 'Norway');
  await saveEntry(page);

  await page.click('#tabLogbook');
  await page.locator('.entry-card-header').last().click();
  await page.click('[data-action="edit"]');
  await page.locator('#inputDate').click();
  await page.click('#dpNextYear');
  const thisMonth = new Date().getMonth();
  await page.locator(`#dpGrid [data-month="${thisMonth}"]`).click();
  await page.click('#dpChoose');
  await expect(page.locator('#sameVisitNotice')).toBeVisible();
  await page.click('#btnSave');
  await expect(page.locator('#toast')).toContainText('is already logged');
  await page.click('#tabLogbook');
  await expect(page.locator('.entry-card')).toHaveCount(2);
});

test('M6: deleting the entry open in the form turns the form into a new entry', async ({ page }) => {
  await addEntry(page, 'Oslo', 'Norway');
  await page.click('#tabLogbook');
  await page.locator('.entry-card-header').first().click();
  await page.click('[data-action="edit"]');
  await page.fill('#inputNotes', 'unsaved thoughts');
  await page.click('#tabLogbook');
  await page.locator('.entry-card-header').first().click();
  await page.click('[data-action="delete"]');
  await expect(page.locator('.entry-card')).toHaveCount(0);
  // What was typed stays; Save now adds a new entry rather than resurrecting the old one.
  await page.click('#tabNew');
  await expect(page.locator('#btnSave')).toHaveText('Save Entry');
  await expect(page.locator('#inputNotes')).toHaveValue('unsaved thoughts');
  await expect(page.locator('#sameVisitNotice')).toHaveCount(0);
});

test('shares a city card', async ({ page }) => {
  await addEntry(page, 'Lisbon', 'Portugal');
  await page.click('#tabLogbook');
  await page.locator('.entry-card-header').first().click();
  await page.click('[data-action="share"]');
  const card = await savedFile(page, 'CACHE', /^ledger-lisbon\.png$/, true);
  expect(card.data.subarray(1, 4).toString()).toBe('PNG');
});

test('L12: a long ledger draws a page of cards at a time', async ({ page }, info) => {
  const entries = Array.from({ length: 150 }, (_, i) => ({
    id: `e${i}`, city: `City ${i}`, state: 'Region', date: `${2000 + (i % 26)}-${String((i % 12) + 1).padStart(2, '0')}`,
    ratings: { greenery: (i % 10) + 1 }, notes: '', savedAt: '2026-01-01T00:00:00Z',
  }));
  const file = info.outputPath('big.json');
  await writeFile(file, JSON.stringify({ schemaVersion: 2, entries }));
  await page.click('#tabSettings');
  await page.setInputFiles('#importFile', file);
  await expect(page.locator('#toast')).toContainText('150 added');
  await page.click('#settingsBack');
  await page.click('#tabLogbook');
  await expect(page.locator('.entry-card')).toHaveCount(60);
  await page.click('#showMore');
  await expect(page.locator('.entry-card')).toHaveCount(120);
  await page.click('#showMore');
  await expect(page.locator('.entry-card')).toHaveCount(150);
  await expect(page.locator('#showMore')).toHaveCount(0);
  // Year headings still count every city in the year.
  await expect(page.locator('.year-group[data-year="2025"] .year-group-meta')).toContainText('5 cities');
});

test('hostile text in city, region and notes renders as text', async ({ page }) => {
  let dialogs = 0;
  page.on('dialog', () => dialogs++);
  await addEntry(page, '<img src=x onerror=alert(1)>', '"><svg onload=alert(2)>');
  await page.click('#tabLogbook');
  await expect(page.locator('.entry-card')).toContainText('<img src=x onerror=alert(1)>');
  await page.click('#tabInsights');
  await page.click('#tabMap');
  await page.waitForTimeout(300);
  expect(dialogs).toBe(0);
});
