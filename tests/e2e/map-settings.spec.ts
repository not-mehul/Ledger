import { expect, test } from '@playwright/test';
import { addEntry, openApp, pickCity, saveEntry } from './helpers';

test('maps picked and typed cities', async ({ page }) => {
  await openApp(page);
  await pickCity(page, 'Kyot', 'Japan');
  await saveEntry(page);
  await addEntry(page, 'Paris', 'France'); // typed, placed by name on the map
  await addEntry(page, 'Nowhereville', 'Atlantis');

  await page.click('#tabMap');
  await expect(page.locator('svg.map circle.dot')).toHaveCount(2);
  await expect(page.locator('#viewMap .logbook-count')).toHaveText('2 cities · 2 countries');
  await expect(page.locator('.map-note')).toContainText("1 city isn't on the map yet");

  await page.locator('.pin[aria-label="Kyoto, Japan"]').dispatchEvent('click');
  // Its two actions are icons in one row.
  const actions = page.locator('.map-selected .selected-actions .btn-icon');
  await expect(actions).toHaveCount(2);
  await page.waitForTimeout(600); // the card's entrance
  const [a, b] = [(await actions.nth(0).boundingBox())!, (await actions.nth(1).boundingBox())!];
  expect(Math.abs(a.y + a.height / 2 - (b.y + b.height / 2))).toBeLessThan(1);
  expect(b.x).toBeGreaterThan(a.x + a.width - 1);
  await expect(page.locator('#btnMovePin')).toHaveAccessibleName('Move pin');
  await page.getByRole('button', { name: 'Open in ledger' }).click();
  await expect(page.locator('.entry-card.open .entry-city-name')).toContainText('Kyoto');
});

test('switches theme in Settings, and remembers it', async ({ page }) => {
  await openApp(page);
  await page.click('#tabSettings');
  await page.click('[data-theme-option="light"]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  // Settings is its own screen: a back button and its title.
  await expect(page.locator('.screen-header-title')).toHaveText('Settings');
  await page.click('#settingsBack');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('follows the phone\'s language', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'de-DE' });
  const page = await context.newPage();
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('#tabNew')).toHaveText('Eintrag');
  await expect(page.locator('#tabInsights')).toHaveText('Auswertung');
  await context.close();
});

test('hides easter eggs, counts them once, and lists the count in Settings', async ({ page }) => {
  await openApp(page);
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) {
    await page.keyboard.press(key);
  }
  await expect(page.locator('.toast[data-kind="celebrate"]')).toHaveText('Passport stamped. Wherever next? Easter egg found: 1 of 4.');

  for (let i = 0; i < 7; i++) await page.locator('.t-page-title').click();
  await expect(page.locator('.toast[data-kind="celebrate"]')).toHaveText('Wanderlust: confirmed. Easter egg found: 2 of 4.');

  await page.click('#tabSettings');
  await expect(page.locator('#eggCount')).toHaveText('Easter eggs: 2 of 4 found');
});

test('left alone, a passport stamp inks cities; eight fills the page', async ({ page }) => {
  await page.clock.install();
  await openApp(page);
  await page.clock.runFor(41_000);
  const dock = page.getByTestId('idle-dock');
  await expect(dock).toBeVisible();
  await expect(dock.locator('.idle-line')).toHaveText('Somewhere new? Stamp it.');
  const stamp = dock.getByRole('button', { name: 'Stamp the passport' });
  await stamp.click();
  await expect(dock.locator('.city')).toHaveText('Lisboa');
  for (let i = 1; i < 8; i++) await stamp.click();
  await expect(page.locator('.toast[data-kind="celebrate"]')).toHaveText('Every page stamped. Time for a new passport. Easter egg found: 1 of 4.');
  await page.locator('#inputCity').click();
  await expect(dock).toHaveCount(0);
});
