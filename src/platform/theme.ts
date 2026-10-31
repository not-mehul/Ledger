import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import type { ThemeSetting } from '../domain/doc';
import { isNative } from './output';

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
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface || '#0f0d0b');
  if (isNative) {
    // DARK = light icons for dark backgrounds.
    void SystemBars.setStyle({ style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(
      () => undefined,
    );
  }
}

media?.addEventListener('change', () => {
  if (current === 'system') paint();
});

export function applyTheme(setting: ThemeSetting): void {
  current = setting;
  paint();
}
