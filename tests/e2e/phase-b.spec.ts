// Feature review, Phase B: local names, Near me, and placing a city by hand.
import { expect, test } from '@playwright/test';
import { addEntry, importPlaces, openApp, pickCity, saveEntry } from './helpers';

test('a city typed in its own language is found and placed', async ({ page }) => {
  await openApp(page);
  await pickCity(page, 'Wien', 'Austria');
  await expect(page.locator('#inputCity')).toHaveValue('Vienna');
  await expect(page.locator('#inputState')).toHaveValue('Austria');
  await saveEntry(page);
  // And typed whole, it's placed on the map without picking.
  await addEntry(page, 'Praha', 'Czechia');
  await page.click('#tabMap');
  await expect(page.locator('.countries .settings-row[data-country="CZ"]')).toBeVisible();
  await expect(page.locator('.countries .settings-row[data-country="SK"]')).toHaveCount(0);
});

test('Near me offers the towns around you, the city you are in first', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 38.7077, longitude: -9.1365 });
  await openApp(page);
  await page.click('#btnNearMe');
  const rows = page.locator('#nearbyList .settings-row');
  await expect(rows.first()).toContainText('Lisbon');
  await expect(rows.first()).toContainText('Portugal');
  await rows.first().click();
  await expect(page.locator('#nearbyList')).toHaveCount(0);
  await expect(page.locator('#inputCity')).toHaveValue('Lisbon');
  await expect(page.locator('#inputState')).toHaveValue('Portugal');
  await expect(page.locator('.located')).toBeVisible();
});

test('Near me says so when location is off', async ({ page }) => {
  await openApp(page);
  await page.click('#btnNearMe');
  await expect(page.locator('#toast')).toHaveText("Location is off for Ledger. Allow it in Android's settings, or type the city.");
});

test('a city the list does not have is placed by hand, and the pin can move', async ({ page }, info) => {
  await openApp(page);
  await importPlaces(page, info.outputPath('seed.json'), [['Lisbon', 'Portugal', 'PT', 38.72, -9.14]]);
  await addEntry(page, 'Nowhereville', 'Portugal');
  await page.click('#tabMap');
  await expect(page.locator('.unplaced-note')).toContainText("1 city isn't on the map yet.");
  await page.click('#btnPlaceByHand');
  await expect(page.locator('#pinNotice')).toContainText('Tap the map where Nowhereville is.');

  // Zoom in on Lisbon (about 16 px to a degree), then tap a little inland, far
  // enough off that the two pins don't group.
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const lisbon = (await page.locator('.pin[aria-label="Lisbon, Portugal"] .dot').boundingBox())!;
  await page.mouse.click(lisbon.x + lisbon.width / 2 + 28, lisbon.y + lisbon.height / 2);
  await expect(page.locator('#toast')).toContainText('Nowhereville is on the map.');
  await expect(page.locator('.unplaced-note')).toHaveCount(0);
  await expect(page.locator('.countries .settings-row[data-country="PT"] .settings-row-value')).toHaveText('2');
  await expect(page.locator('.map-selected')).toContainText('Nowhereville');

  // Move it, then undo the move.
  const pin = page.locator('.pin[aria-label="Nowhereville, Portugal"] .dot');
  await page.click('#btnMovePin');
  // Measured after the tap on Move pin, which may scroll the page.
  const first = (await pin.boundingBox())!;
  await page.mouse.click(first.x + first.width / 2 + 6, first.y + first.height / 2 + 8);
  await expect(page.locator('#toast')).toContainText('Nowhereville is on the map.');
  await expect.poll(async () => Math.round((await pin.boundingBox())!.y - first.y)).toBeGreaterThan(4);
  await page.locator('#toast').getByRole('button', { name: 'Undo' }).click();
  // Back where it was (centres, as a selected pin draws larger).
  const centreY = async () => {
    const b = (await pin.boundingBox())!;
    return b.y + b.height / 2;
  };
  await expect.poll(async () => Math.round((await centreY()) - (first.y + first.height / 2))).toBe(0);

  // Tapping the sea doesn't place it.
  await page.click('#btnMovePin');
  const here = (await page.locator('.pin[aria-label="Lisbon, Portugal"] .dot').boundingBox())!;
  await page.mouse.click(here.x - 120, here.y);
  await expect(page.locator('#toast')).toHaveText("That's open water. Tap on land.");
  await expect(page.locator('#pinNotice')).toBeVisible();
  await page.locator('#pinNotice').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#pinNotice')).toHaveCount(0);
});
