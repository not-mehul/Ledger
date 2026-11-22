// The map opens framed on your cities, groups pins that would overlap, and
// lists the countries you have been to (UI review, Phase 3).
import { expect, test, type Page } from '@playwright/test';
import { importPlaces, openApp } from './helpers';

const zoomOf = async (page: Page) =>
  Number((await page.locator('svg.map > g').getAttribute('transform'))!.match(/scale\(([\d.]+)\)/)![1]);

test('opens zoomed to the cities you have logged', async ({ page }, info) => {
  await openApp(page);
  await importPlaces(page, info.outputPath('seed.json'), [
    ['Lisbon', 'Portugal', 'PT', 38.72, -9.14],
    ['Madrid', 'Madrid', 'ES', 40.42, -3.7],
    ['Berlin', 'Berlin', 'DE', 52.52, 13.4],
  ]);
  await page.click('#tabMap');
  await expect(page.locator('.pin[aria-label="Berlin, Berlin"]')).toBeVisible();
  expect(await zoomOf(page)).toBeGreaterThan(2.5);

  // Every pin is inside the frame.
  const frame = (await page.locator('.map-frame').boundingBox())!;
  for (const pin of await page.locator('.pin .dot').all()) {
    const b = (await pin.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(frame.x);
    expect(b.x + b.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(b.y).toBeGreaterThanOrEqual(frame.y);
    expect(b.y + b.height).toBeLessThanOrEqual(frame.y + frame.height);
  }

  // Zooming out and resetting comes back to the same framing.
  const fitted = await zoomOf(page);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  expect(await zoomOf(page)).toBeLessThan(fitted);
  await page.getByRole('button', { name: 'Reset view' }).click();
  expect(await zoomOf(page)).toBeCloseTo(fitted, 1);
});

test('groups pins that would overlap, and a group opens into its cities', async ({ page }, info) => {
  await openApp(page);
  await importPlaces(page, info.outputPath('seed.json'), [
    ['Lisbon', 'Portugal', 'PT', 38.72, -9.14],
    ['Porto', 'Portugal', 'PT', 41.15, -8.61],
    ['Kyoto', 'Japan', 'JP', 35.01, 135.77],
    ['Austin', 'Texas', 'US', 30.27, -97.74],
  ]);
  await page.click('#tabMap');
  const group = page.locator('.pin.group', { has: page.locator('text.count', { hasText: '2' }) });
  await expect(group).toHaveAttribute('aria-label', /2 cities: (Lisbon, Porto|Porto, Lisbon)/);
  await expect(page.locator('.pin[aria-label="Lisbon, Portugal"]')).toHaveCount(0);

  const before = await zoomOf(page);
  await group.dispatchEvent('click');
  await expect(page.locator('.pin[aria-label="Lisbon, Portugal"]')).toBeVisible();
  await expect(page.locator('.pin[aria-label="Porto, Portugal"]')).toBeVisible();
  expect(await zoomOf(page)).toBeGreaterThan(before);
});

test('cities in the same spot are listed rather than zoomed apart', async ({ page }, info) => {
  await openApp(page);
  await importPlaces(page, info.outputPath('seed.json'), [
    ['Lisbon', 'Portugal', 'PT', 38.72, -9.14],
    ['Lisboa', 'Portugal', 'PT', 38.7201, -9.1401],
    ['Kyoto', 'Japan', 'JP', 35.01, 135.77],
  ]);
  await page.click('#tabMap');
  await page.locator('.pin.group').dispatchEvent('click');
  const list = page.locator('.map-group');
  await expect(list).toContainText('2 cities here');
  await list.getByRole('button', { name: /Lisboa/ }).click();
  await expect(page.locator('.entry-card.open .entry-city-name')).toContainText('Lisboa');
});

test('lists visited countries, most cities first, and shows each on the map', async ({ page }, info) => {
  await openApp(page);
  await importPlaces(page, info.outputPath('seed.json'), [
    ['Kyoto', 'Japan', 'JP', 35.01, 135.77],
    ['Lisbon', 'Portugal', 'PT', 38.72, -9.14],
    ['Porto', 'Portugal', 'PT', 41.15, -8.61],
  ]);
  await page.click('#tabMap');
  const rows = page.locator('.countries .settings-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Portugal');
  await expect(rows.nth(0)).toContainText('Lisbon, Porto');
  await expect(rows.nth(0).locator('.settings-row-value')).toHaveText('2');
  await expect(rows.nth(1)).toContainText('Japan');

  // One city: the map goes to it and opens it.
  await rows.nth(1).click();
  await expect(page.locator('.map-selected')).toContainText('Kyoto');
  expect(await zoomOf(page)).toBeGreaterThan(4);
});
