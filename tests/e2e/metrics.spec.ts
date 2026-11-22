import { expect, test } from '@playwright/test';
import { closeSheet, openApp, openMetrics } from './helpers';

test('custom metrics change the form and the score', async ({ page }) => {
  await openApp(page);
  await openMetrics(page);
  const detail = page.locator('dialog.sheet[open]').last();

  // Re-weight Internet Speed to the maximum.
  await page.locator('.metric-row[data-metric="internet"] .settings-row').click();
  await expect(detail.locator('.sheet-title')).toHaveText('Internet Speed');
  await detail.getByRole('combobox', { name: 'Weight' }).click();
  await page.locator('.dd-option[data-value="5"]').click();
  await expect(page.locator('.metric-row[data-metric="internet"] .settings-row-value')).toHaveText('×5');
  await closeSheet(page);

  // Hide Air Quality.
  await page.locator('.metric-row[data-metric="airQuality"] .settings-row').click();
  await detail.getByRole('button', { name: 'Hide' }).click();
  await expect(detail.getByRole('button', { name: 'Show' })).toHaveAttribute('aria-pressed', 'true');
  await closeSheet(page);
  await expect(page.locator('.metric-row[data-metric="airQuality"]')).toHaveClass(/archived/);

  // Add a custom metric in the food category: its sheet opens to name it.
  await page.locator('section.cat').nth(2).getByRole('button', { name: 'Add metric' }).click();
  const name = detail.getByLabel('Name');
  await expect(name).toHaveValue('New metric');
  await name.fill('Coffee');
  await name.blur();
  await expect(detail.locator('.sheet-title')).toHaveText('Coffee');
  await closeSheet(page);
  await expect(page.locator('section.cat').nth(2).locator('.metric-row').last()).toContainText('Coffee');
  await closeSheet(page);
  await expect(page.locator('#metricsEditor')).toContainText('1 hidden');

  await page.click('#settingsBack');
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
  await openMetrics(page);
  const hideButtons = page.locator('.cat-head').getByRole('button', { name: 'Hide', exact: true });
  for (let left = await hideButtons.count(); left > 1; left--) {
    await hideButtons.first().click();
    await expect(hideButtons).toHaveCount(left - 1);
  }
  await hideButtons.first().click();
  await expect(page.locator('#toast')).toHaveText('Keep at least one metric visible.');
});

test('dragging a metric by its grip reorders it, and its sheet can move it back', async ({ page }) => {
  await openApp(page);
  await openMetrics(page);
  const rows = page.locator('section.cat').first().locator('.metric-row');
  const first = await rows.nth(0).getAttribute('data-metric');
  const second = await rows.nth(1).getAttribute('data-metric');

  // Drag the first row's grip below the second row.
  const grip = rows.nth(0).locator('.grip');
  const from = (await grip.boundingBox())!;
  const target = (await rows.nth(1).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, target.y + target.height * 0.9, { steps: 8 });
  await page.mouse.up();
  await expect(rows.nth(0)).toHaveAttribute('data-metric', second!);
  await expect(rows.nth(1)).toHaveAttribute('data-metric', first!);

  // Move up in the metric's own sheet undoes it, for anyone who cannot drag.
  await rows.nth(1).locator('.settings-row').click();
  const detail = page.locator('dialog.sheet[open]').last();
  await detail.getByRole('button', { name: 'Move up' }).click();
  await expect(detail.getByRole('button', { name: 'Move up' })).toBeDisabled();
  await closeSheet(page);
  await expect(rows.nth(0)).toHaveAttribute('data-metric', first!);

  // Survives a reload.
  await page.reload();
  await openMetrics(page);
  await expect(page.locator('section.cat').first().locator('.metric-row').first()).toHaveAttribute('data-metric', first!);
});

test('a category is renamed and given a new icon from its own sheet', async ({ page }) => {
  await openApp(page);
  await openMetrics(page);
  const cat = page.locator('section.cat').first();
  await cat.getByRole('button', { name: /^Edit / }).click();
  const detail = page.locator('dialog.sheet[open]').last();
  await detail.getByLabel('Category name').fill('Outdoors');
  await detail.getByLabel('Category name').blur();
  const icon = detail.getByRole('radio', { checked: false }).first();
  const iconName = (await icon.getAttribute('aria-label'))!;
  await icon.click();
  await expect(detail.getByRole('radio', { name: iconName })).toHaveAttribute('aria-checked', 'true');
  await closeSheet(page);
  await expect(cat.locator('.cat-name')).toHaveText('Outdoors');
});
