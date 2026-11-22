// City suggestions start from the quick list (towns of 10,000 or more) and
// widen to every town once the whole list has loaded (UI review, U15).
import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test('suggestions come from the quick list first, then the whole one', async ({ page }) => {
  // Hold the whole list back until the test lets it go.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  const fetched: string[] = [];
  await page.route('**/data/places*.txt', async (route) => {
    const url = route.request().url();
    fetched.push(url.split('/').pop()!);
    if (url.endsWith('/places.txt')) await held;
    await route.continue();
  });
  await openApp(page);

  await page.fill('#inputCity', 'Lisb');
  await expect(page.locator('#citySuggestions li').first()).toContainText('Lisbon');
  expect(fetched).toEqual(['places-quick.txt', 'places.txt']);

  // A village of 6,000 is only in the whole list.
  await page.fill('#inputCity', 'Zermatt');
  await expect(page.locator('#citySuggestions')).toHaveCount(0);
  release();
  await expect(page.locator('#citySuggestions li').first()).toContainText('Zermatt');
  await expect(page.locator('#citySuggestions li').first()).toContainText('Switzerland');
});
