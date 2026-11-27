import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import type { ThemeSetting } from '../domain/doc';

/** Read by the inline script in index.html, so the first paint has the right theme. */
const STORAGE_KEY = 'ledger.theme';

const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
let current: ThemeSetting = 'system';

function resolved(setting: ThemeSetting): 'light' | 'dark' {
  if (setting !== 'system') return setting;
  return media?.matches === false ? 'light' : 'dark';
}

function paint(): void {
  const theme = resolved(current);
  document.documentElement.dataset.theme = theme;
  const surface = getComputedStyle(document.documentElement).getPropertyValue('--bg-grad-mid').trim();
  if (surface) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface);
  // DARK = light icons for dark backgrounds.
  void SystemBars.setStyle({
    style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  }).catch(() => undefined);
  dispatchEvent(new Event('themechange'));
}

media?.addEventListener('change', () => {
  if (current === 'system') paint();
});

export function applyTheme(setting: ThemeSetting): void {
  current = setting;
  try {
    localStorage.setItem(STORAGE_KEY, setting);
  } catch {
    // Private mode: the first paint falls back to the system theme.
  }
  paint();
}
