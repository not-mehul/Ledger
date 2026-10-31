// ============================================================
// Ledger — app entry point: loads data, applies preferences and
// mounts the Svelte UI.
// ============================================================

import { App as CapacitorApp } from '@capacitor/app';
import { mount } from 'svelte';
import App from './App.svelte';
import { detectLocale, setLocale } from './i18n/index.svelte';
import { isNative } from './platform/output';
import { applyTheme } from './platform/theme';
import { ledger } from './state/ledger.svelte';
import { autoBackupIfDue } from './state/transfer';
import { ui } from './state/ui.svelte';
import './styles/app.css';

async function start(): Promise<void> {
  await ledger.init();

  // Apply preferences before the first paint; App.svelte keeps them in sync afterwards.
  const { theme, language } = ledger.settings;
  applyTheme(theme);
  await setLocale(language === 'system' ? detectLocale() : language).catch(() => undefined);

  mount(App, { target: document.getElementById('app')! });

  if (isNative) {
    // Android back: close overlays, then return to the Entry tab, then exit.
    void CapacitorApp.addListener('backButton', () => {
      if (!ui.back()) void CapacitorApp.exitApp();
    });
    void CapacitorApp.addListener('resume', () => void autoBackupIfDue());
  }
  void autoBackupIfDue();
}

void start();
