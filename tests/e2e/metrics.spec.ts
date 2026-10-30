import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test('custom metrics change the form and the score', async ({ page }) => {
  await openApp(page);
  await page.click('#tabSettings');
  await page.click('#metricsEditor summary');

  // Re-weight Internet Speed to the maximum and hide Air Quality.
  const internet = page.locator('[data-metric="internet"]');
  await internet.locator('select').first().selectOption('5');
  await page.locator('[data-metric="airQuality"]').getByRole('button', { name: 'Hide' }).click();

  // Add a custom metric in the food category and name it.
  const food = page.locator('fieldset.cat-edit').nth(2);
  await food.getByRole('button', { name: '+ Add metric' }).click();
  const name = food.locator('.metric-edit').last().getByLabel('Name');
  await expect(name).toHaveValue('New metric');
  await name.fill('Coffee');
  await name.blur();
  await expect(name).toHaveValue('Coffee');

  await page.click('#tabNew');
  await expect(page.locator('#sl-airQuality')).toHaveCount(0);
  await expect(page.getByLabel('Coffee')).toBeVisible();
  await expect(page.locator('#viewNew .slider-weight').filter({ hasText: '×5' })).toHaveCount(1);

  await page.locator('#sl-internet').fill('10');
  // Weights now total 20 (Air Quality hidden, Coffee ×1, Internet ×5): (5×15 + 10×5) / 200.
  await expect(page.locator('#scoreDisplay')).toHaveText('62.5');

  // Survives a reload.
  await page.reload();
  await expect(page.getByLabel('Coffee')).toBeVisible();
});

test('keeps at least one metric visible', async ({ page }) => {
  await openApp(page);
  await page.click('#tabSettings');
  await page.click('#metricsEditor summary');
  const hideButtons = page.locator('.cat-head').getByRole('button', { name: 'Hide', exact: true });
  for (let left = await hideButtons.count(); left > 1; left--) {
    await hideButtons.first().click();
    await expect(hideButtons).toHaveCount(left - 1);
  }
  await hideButtons.first().click();
  await expect(page.locator('#toast')).toHaveText('Keep at least one metric visible.');
});
