import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { addEntry, openApp, saveEntry, savedFile } from './helpers';

/** Exports from the sheet; the file lands in Documents/Ledger (IndexedDB in the test build). */
async function exportFormat(page: Page, format: string, name: RegExp, binary = false) {
  await page.click('#btnExport');
  await page.click(`.sheet [data-format="${format}"]`);
  await expect(page.locator('#toast')).toContainText('Saved to Documents/Ledger/');
  return savedFile(page, 'DOCUMENTS/Ledger', name, binary);
}

test('exports Markdown and a full backup, and restores it', async ({ page }, info) => {
  await openApp(page);
  await page.fill('#inputCity', 'Lisbon');
  await page.fill('#inputState', 'Portugal');
  await page.fill('#inputNotes', 'Tiles\u2028and trams');
  await saveEntry(page);
  await addEntry(page, 'Kyoto', 'Japan');

  const md = await exportFormat(page, 'markdown', /^ledger-\d{4}-\d{2}-\d{2}\.md$/);
  expect(md.data.toString('utf8')).toContain('## Lisbon · Portugal');
  await page.click('#btnExport');
  await expect(page.locator('.sheet [data-format]')).toHaveCount(2);
  await page.locator('.sheet .sheet-close').click();

  const backup = await exportFormat(page, 'backup', /^ledger-backup-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/, true);
  const zipPath = info.outputPath(backup.name);
  await writeFile(zipPath, backup.data);
  const mdPath = info.outputPath(md.name);
  await writeFile(mdPath, md.data);

  // Wipe the ledger, then restore it from the backup.
  await page.click('#tabLogbook');
  for (let i = 0; i < 2; i++) {
    await page.locator('.entry-card-header').first().click();
    await page.click('[data-action="delete"]');
  }
  // IconTabs shows no count on the icon when the logbook is empty.
  await expect(page.locator('#tabLogbook .badge')).toHaveCount(0);

  await page.click('#tabSettings');
  await page.setInputFiles('#importFile', zipPath);
  await expect(page.locator('#toast')).toHaveText('Import complete: 2 added, 0 updated.');
  // The Markdown export reads back too, separators in the notes and all.
  await page.setInputFiles('#importFile', mdPath);
  await expect(page.locator('#toast')).toHaveText('Import complete: 0 added, 0 updated, 2 already up to date.');
  await page.click('#settingsBack');
  await page.click('#tabLogbook');
  await page.locator('.entry-card', { hasText: 'Lisbon' }).locator('.entry-card-header').click();
  await expect(page.locator('.entry-notes-text')).toContainText('Tiles');
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
  await page.click('#settingsBack');
  await page.click('#tabLogbook');
  await expect(page.locator('.entry-meta')).toContainText('March 2024');
  // Only the two rated metrics count: (9×2 + 8×2) / (2+2) → 85.
  await expect(page.getByRole('img', { name: 'Score 85 out of 100' })).toBeVisible();
});
