import { expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export const PHOTO = fileURLToPath(new URL('fixtures/skyline.jpg', import.meta.url));

/** Opens the app with an empty ledger and fails the test on any page error. */
export async function openApp(page: Page): Promise<void> {
  page.on('pageerror', (err) => {
    throw err;
  });
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await expect(page.locator('#fileStatus.connected')).toBeVisible();
}

/** Types a city and picks the first suggestion whose details contain `where`. */
export async function pickCity(page: Page, query: string, where: string): Promise<void> {
  await page.fill('#inputCity', query);
  await page.locator('#citySuggestions li', { hasText: where }).first().dispatchEvent('pointerdown');
}

export async function saveEntry(page: Page): Promise<void> {
  await page.click('#btnSave');
  await expect(page.locator('#toast')).toContainText(/Saved|Updated/);
}

export async function addEntry(page: Page, city: string, region: string, ratings: Record<string, number> = {}): Promise<void> {
  await page.click('#tabNew');
  await page.fill('#inputCity', city);
  await page.fill('#inputState', region);
  for (const [id, value] of Object.entries(ratings)) await page.locator(`#sl-${id}`).fill(String(value));
  await saveEntry(page);
}
