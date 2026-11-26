import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addEntry, openApp } from './helpers';

// Accessibility: axe finds no WCAG 2.1 A/AA problems on each tab, and with
// text at 200% (WCAG 1.4.4) nothing is wider than a phone screen.

const TABS = ['#tabNew', '#tabLogbook', '#tabMap', '#tabInsights', '#tabSettings'];

async function axe(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    where,
  ).toEqual([]);
}

async function fits(page: Page, where: string) {
  const over = await page.evaluate(() => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth);
  expect(over, where).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await addEntry(page, 'Lisbon', 'Portugal', { safety: 8 });
  await addEntry(page, 'Kyoto', 'Japan');
});

test('every tab passes axe', async ({ page }) => {
  for (const tab of TABS) {
    await page.click(tab);
    await axe(page, tab);
  }
});

test('every tab fits with text at 200%', async ({ page }) => {
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  for (const tab of TABS) {
    await page.click(tab);
    await fits(page, tab);
  }
});

test('settings always offer backup to a folder', async ({ page }) => {
  await page.click('#tabSettings');
  await expect(page.getByRole('radiogroup', { name: 'Back up automatically' })).toBeVisible();
  // The test build has no folder picker: choosing one fails gently, in the backup's own status line.
  await page.getByRole('button', { name: 'Choose' }).click();
  await expect(page.locator('#backupNotice')).toHaveText("The backup didn't finish. Check that the folder is still there, and try again.");
});
