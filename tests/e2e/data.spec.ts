import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { addEntry, openApp } from './helpers';

const ENTRIES = [
  { id: 'lis', city: 'Lisbon', state: 'Portugal', country: 'PT', date: '2025-04', notes: 'Tiles and trams', savedAt: '2025-05-01T00:00:00.000Z', ratings: { greenery: 7 } },
  { id: 'kyo', city: 'Kyoto', state: 'Japan', country: 'JP', date: '2025-10', notes: '', savedAt: '2025-11-01T00:00:00.000Z', ratings: { greenery: 9 } },
];

test('Backup is one place: a folder, how often, and nothing to export', async ({ page }) => {
  await openApp(page);
  // No export or theme switch in the header: only Settings.
  await expect(page.locator('#btnExport, .theme-toggle')).toHaveCount(0);
  await expect(page.locator('#tabLogbook .badge')).toHaveCount(0);
  await addEntry(page, 'Lisbon', 'Portugal');
  await expect(page.locator('#tabLogbook .badge')).toHaveCount(0);

  await page.click('#tabSettings');
  await expect(page.locator('#languageSelect')).toHaveCount(0);
  await expect(page.locator('#backupFolder')).toHaveText('Not chosen yet');
  await expect(page.locator('#btnChooseFolder')).toHaveText('Choose');
  // Daily by default, as BookShelf has it; Back up now and Stop need a folder first.
  await expect(page.locator('[data-every="daily"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#btnBackupNow, #btnStopBackup')).toHaveCount(0);

  await page.click('[data-every="off"]');
  await expect(page.locator('#backupSection')).toContainText('Only when you tap Back up now.');
  await page.reload();
  await page.click('#tabSettings');
  await expect(page.locator('[data-every="off"]')).toHaveAttribute('aria-checked', 'true');
});

test('restores a backup, and restoring it again changes nothing', async ({ page }, info) => {
  await openApp(page);
  const file = info.outputPath('ledger-backup.json');
  await writeFile(file, JSON.stringify({ app: 'ledger', schemaVersion: 2, entries: ENTRIES }));

  await page.click('#tabSettings');
  await page.setInputFiles('#importFile', file);
  await expect(page.locator('#toast')).toHaveText('Restored: 2 added, 0 updated.');
  await page.setInputFiles('#importFile', file);
  await expect(page.locator('#toast')).toHaveText('Restored: 0 added, 0 updated, 2 already up to date.');
  await page.click('#settingsBack');
  await page.click('#tabLogbook');
  await page.locator('.entry-card', { hasText: 'Lisbon' }).locator('.entry-card-header').click();
  await expect(page.locator('.entry-notes-text')).toContainText('Tiles');
});

test('a file that is not a backup says so', async ({ page }, info) => {
  await openApp(page);
  const file = info.outputPath('notes.json');
  await writeFile(file, JSON.stringify({ hello: 'world' }));
  await page.click('#tabSettings');
  await page.setInputFiles('#importFile', file);
  await expect(page.locator('#toast')).toHaveText('No Ledger entries found in that file.');
});
