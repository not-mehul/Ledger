// Feature review, Phase C: text shared to Ledger, and the "Rate a city"
// shortcut. On a phone these arrive as ledger:// links (MainActivity.java,
// shortcuts.xml); here the test hands the app the same links.
import { expect, test, type Page } from '@playwright/test';
import { addEntry, openApp } from './helpers';

/** Hands the app a link as Android would (src/platform/incoming.ts exposes this under automation only). */
async function openLink(page: Page, url: string) {
  await page.waitForFunction(() => '__ledgerLink' in window);
  await page.evaluate((u) => (window as unknown as { __ledgerLink: (url: string) => void }).__ledgerLink(u), url);
}

test('a place shared from a map app starts an entry for its town', async ({ page }) => {
  await openApp(page);
  await addEntry(page, 'Austin', 'Texas');
  await page.click('#tabLogbook');
  const shared = 'A Brasileira\nRua Garrett 120, 1200-273 Lisboa, Portugal\nhttps://maps.app.goo.gl/abc123';
  await openLink(page, `ledger://share?text=${encodeURIComponent(shared)}`);
  await expect(page.locator('#viewNew')).toBeVisible();
  await expect(page.locator('#inputCity')).toHaveValue('Lisbon');
  await expect(page.locator('#inputState')).toHaveValue('Portugal');
  await expect(page.locator('.located')).toBeVisible();
  await expect(page.locator('#toast')).toHaveText('Started an entry for Lisbon. Rate it and save.');
});

test('shared text with no town says so', async ({ page }) => {
  await openApp(page);
  await openLink(page, `ledger://share?text=${encodeURIComponent('Great coffee!')}`);
  await expect(page.locator('#toast')).toHaveText("Couldn't find a town in what was shared. Type the city instead.");
});

test('the Rate a city shortcut opens the Entry tab and keeps a draft', async ({ page }) => {
  await openApp(page);
  await page.fill('#inputCity', 'Porto');
  await page.click('#tabMap');
  await openLink(page, 'ledger://new');
  await expect(page.locator('#viewNew')).toBeVisible();
  await expect(page.locator('#inputCity')).toHaveValue('Porto');
});
