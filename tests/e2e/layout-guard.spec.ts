// A layout guard over every screen (UI review, Phase 3): at 360 and 412 px,
// in both themes, nothing runs past the screen edge, no two controls overlap,
// and no clipped box hides its own text.
import { expect, test, type Page } from '@playwright/test';
import { importPlaces, openApp, sheetSettled } from './helpers';

const PLACES = [
  ['Lisbon', 'Portugal', 'PT', 38.72, -9.14],
  ['Porto', 'Portugal', 'PT', 41.15, -8.61],
  ['Kyoto', 'Japan', 'JP', 35.01, 135.77],
  ['San Cristóbal de las Casas', 'Chiapas', 'MX', 16.74, -92.64],
  ['Berlin', 'Berlin', 'DE', 52.52, 13.4],
] as const;

/** Problems on screen now, inside the topmost open dialog if there is one. */
async function problems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const vw = document.documentElement.clientWidth;
    const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')];
    const root: Element = dialogs.at(-1) ?? document.body;
    const name = (el: Element) => {
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).filter((c) => !c.startsWith('svelte-')).join('.')}` : '';
      const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30);
      return `${el.tagName.toLowerCase()}${id}${cls} "${text}"`;
    };
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
    };
    // Floating layers sit over the page on purpose; the toast comes and goes.
    const floating = (el: Element) => !!el.closest('.toast-region, .toast-layer, .action-bar, .tab-bar-sticky, .compare-tray, svg, .dd-listbox');

    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`);

    const all = [...root.querySelectorAll('*')].filter((el) => shown(el) && !el.closest('svg'));
    for (const el of all) {
      const r = el.getBoundingClientRect();
      // Inside a sideways scroller, running past the edge is the point.
      let p = el.parentElement;
      let scrolls = false;
      while (p && p !== root) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') scrolls = true;
        p = p.parentElement;
      }
      if (!scrolls && (r.right > vw + 1 || r.left < -1)) out.push(`past the edge (${Math.round(r.left)}–${Math.round(r.right)} of ${vw}): ${name(el)}`);
      const s = getComputedStyle(el);
      const clips = s.overflowX === 'hidden' || s.overflowX === 'clip';
      if (clips && s.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && el.textContent?.trim() && !el.closest('.visually-hidden') && !el.matches('.visually-hidden')) {
        out.push(`clips its text (${el.scrollWidth} > ${el.clientWidth}): ${name(el)}`);
      }
    }

    const controls = all.filter((el) => el.matches('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="radio"], [role="tab"], [role="combobox"], [role="switch"]') && !floating(el) && !el.closest('[inert]'));
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const [a, b] = [controls[i]!, controls[j]!];
        if (a.contains(b) || b.contains(a)) continue;
        // A label's visible control and its hidden native twin share a box.
        if (a.closest('label') && a.closest('label') === b.closest('label')) continue;
        const [ra, rb] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 1 && h > 1) out.push(`overlap ${Math.round(w)}×${Math.round(h)}: ${name(a)} / ${name(b)}`);
      }
    }
    return out;
  });
}

async function check(page: Page, screen: string) {
  // Let entrances finish, so boxes are where they will stay.
  await page.waitForTimeout(150);
  await page
    .waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 3000 })
    .catch(() => {});
  expect(await problems(page), screen).toEqual([]);
}

for (const scheme of ['dark', 'light'] as const) {
  for (const width of [360, 412]) {
    test(`every screen fits at ${width} px in ${scheme === 'dark' ? 'Dusk' : 'Dawn'}`, async ({ page }, info) => {
      test.setTimeout(90_000);
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 780 });
      await openApp(page);
      await check(page, 'entry, empty');
      await importPlaces(page, info.outputPath('seed.json'), PLACES);

      await page.click('#tabNew');
      await check(page, 'entry');
      await page.click('#tabLogbook');
      await check(page, 'ledger');
      await page.locator('.entry-card-header').first().click();
      await check(page, 'ledger, card open');
      await page.locator('[data-action="compare"]').first().click();
      await page.locator('.entry-card-header').nth(1).click();
      await page.locator('.entry-card.open [data-action="compare"]').last().click();
      await check(page, 'ledger, comparing');
      await page.click('#tabMap');
      await check(page, 'map');
      await page.locator('.pin.group').first().dispatchEvent('click');
      await check(page, 'map, group opened');
      await page.click('#tabInsights');
      await check(page, 'insights');
      await page.click('#valueShowAll');
      await check(page, 'insights, all values');

      await page.click('#tabSettings');
      await check(page, 'settings');
      await page.click('#metricsEditor');
      await sheetSettled(page);
      await check(page, 'metrics editor');
      await page.locator('.metric-row .settings-row').first().click();
      await sheetSettled(page);
      await check(page, 'metric sheet');
      await page.keyboard.press('Escape');
      await page.locator('section.cat').first().getByRole('button', { name: /^Edit / }).click();
      await sheetSettled(page);
      await check(page, 'category sheet');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    });
  }
}
