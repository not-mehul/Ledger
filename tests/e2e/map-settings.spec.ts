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

  await page.locator('circle.dot[aria-label="Kyoto, Japan"]').dispatchEvent('click');
  await page.getByRole('button', { name: 'Open in ledger' }).click();
  await expect(page.locator('.entry-card.open .entry-city-name')).toContainText('Kyoto');
});

test('switches theme and language, and remembers them', async ({ page }) => {
  await openApp(page);
  await page.click('#tabSettings');
  await page.click('[data-theme-option="light"]');
  await page.selectOption('#languageSelect', 'de');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#tabSettings')).toHaveAccessibleName('Einstellungen');
  await expect(page.locator('#tabInsights')).toHaveText('Auswertung');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('#tabNew')).toHaveText('Eintrag');
});
