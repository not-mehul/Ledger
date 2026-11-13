// ============================================================
// Ledger — app entry point: loads data, applies preferences and
// mounts the Svelte UI.
// ============================================================

import { App as CapacitorApp } from '@capacitor/app';
import { mount } from 'svelte';
import App from './App.svelte';
import { detectLocale, locale, setLocale, t } from './i18n/index.svelte';
import { listenForLinks } from './platform/incoming';
import { isNative } from './platform/output';
import { applyTheme } from './platform/theme.svelte';
import { ledger } from './state/ledger.svelte';
import { autoBackupIfDue } from './state/transfer';
import { folderSync } from './state/sync.svelte';
import { ui } from './state/ui.svelte';
import { updateWidget, widgetLines } from './platform/widget';
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
    const refreshWidget = () => updateWidget(widgetLines(ledger.entries, ledger.scoreOf, t, locale()));
    refreshWidget();
    ledger.onChange(() => {
      refreshWidget();
      folderSync.soon();
    });
    void CapacitorApp.addListener('resume', () => {
      void autoBackupIfDue();
      if (folderSync.on) void folderSync.now();
      refreshWidget();
    });
    if (folderSync.on) void folderSync.now();
    // ledger:// links from Waymark and the other apps (style.md §14.1).
    void listenForLinks((prefill) => ui.startEntry(prefill));
  }
  void autoBackupIfDue();
}

void start();
