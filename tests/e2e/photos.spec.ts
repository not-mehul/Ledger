import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PHOTO, openApp, saveEntry } from './helpers';

test('attaches photos, shows them in a lightbox and shares a city card', async ({ page }) => {
  await openApp(page);
  await page.fill('#inputCity', 'Lisbon');
  await page.fill('#inputState', 'Portugal');
  await page.setInputFiles('#photoInput', [PHOTO, PHOTO]);
  await expect(page.locator('.photo-strip img')).toHaveCount(2);
  await page.locator('.photo-strip .remove').first().click();
  await expect(page.locator('.photo-strip img')).toHaveCount(1);
  await saveEntry(page);

  await page.click('#tabLogbook');
  await page.click('.entry-card-header');
  await expect(page.locator('.gallery img')).toHaveCount(1);
  await page.click('.gallery-item');
  await expect(page.locator('.lightbox img')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.lightbox')).toHaveCount(0);

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="share"]')]);
  expect(download.suggestedFilename()).toBe('ledger-lisbon.png');
  const png = await readFile(await download.path());
  expect(png.subarray(1, 4).toString()).toBe('PNG');
});
