import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { PHOTO, addEntry, openApp, saveEntry } from './helpers';

async function exportFormat(page: Page, format: string) {
  await page.click('#btnExport');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click(`.sheet [data-format="${format}"]`)]);
  return download;
}

test('exports every format and restores a full backup', async ({ page }, info) => {
  await openApp(page);
  await page.fill('#inputCity', 'Lisbon');
  await page.fill('#inputState', 'Portugal');
  await page.setInputFiles('#photoInput', PHOTO);
  await expect(page.locator('.photo-strip img')).toHaveCount(1);
  await saveEntry(page);
  await addEntry(page, 'Kyoto', 'Japan');

  const md = await readFile(await (await exportFormat(page, 'markdown')).path(), 'utf8');
  expect(md).toContain('## Lisbon · Portugal');
  const csv = await readFile(await (await exportFormat(page, 'csv')).path(), 'utf8');
  expect(csv.split('\r\n')[0]).toContain('City,Region,Country,Month,Score');
  const json = JSON.parse(await readFile(await (await exportFormat(page, 'json')).path(), 'utf8'));
  expect(json.entries).toHaveLength(2);

  const backup = await exportFormat(page, 'backup');
  expect(backup.suggestedFilename()).toMatch(/^ledger-backup-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/);
  const zipPath = info.outputPath('backup.zip');
  await backup.saveAs(zipPath);

  // Wipe the ledger, then restore it from the backup, photos included.
  await page.click('#tabLogbook');
  for (let i = 0; i < 2; i++) {
    await page.locator('.entry-card-header').first().click();
    await page.click('[data-action="delete"]');
  }
  await expect(page.locator('#entryBadge')).toHaveText('0');

  await page.click('#tabSettings');
  await page.setInputFiles('#importFile', zipPath);
  await expect(page.locator('#toast')).toHaveText('Import complete: 2 added, 0 updated.');
  await page.click('#tabLogbook');
  await page.locator('.entry-card', { hasText: 'Lisbon' }).locator('.entry-card-header').click();
  await expect(page.locator('.gallery img')).toHaveCount(1);
});

test('imports a Travel Logbook export', async ({ page }, info) => {
  await openApp(page);
  const legacy = info.outputPath('logbook.md');
  await writeFile(
    legacy,
    [
      '# ✈️ Travel Logbook',
      '## Austin · Texas',
      '<!-- data:{"id":"lx2k9","city":"Austin","state":"Texas","date":"2024-W10","score":70,"ratings":{"greenery":9,"safety":8},"notes":"Old notes","savedAt":"2024-05-20T12:00:00.000Z"} -->',
    ].join('\n'),
  );
  await page.click('#tabSettings');
  await page.setInputFiles('#importFile', legacy);
  await expect(page.locator('#toast')).toHaveText('Import complete: 1 added, 0 updated.');
  await page.click('#tabLogbook');
  await expect(page.locator('.entry-meta')).toContainText('March 2024');
  // Only the two rated metrics count: (9×2 + 8×2) / (2+2) → 85.
  await expect(page.getByRole('img', { name: 'Score 85 out of 100' })).toBeVisible();
});
