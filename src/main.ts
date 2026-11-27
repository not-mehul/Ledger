// ============================================================
// Ledger — app entry point: loads data, applies preferences and
// mounts the Svelte UI.
// ============================================================

import { App as CapacitorApp } from '@capacitor/app';
import { dismissOverlay } from 'dusk-dawn';
import { mount } from 'svelte';
import App from './App.svelte';
import { detectLocale, locale, setLocale, t } from './i18n/index.svelte';
import { listenForLinks } from './platform/incoming';
import { applyTheme } from './platform/theme';
import { ledger } from './state/ledger.svelte';
import { backup } from './state/backup.svelte';
import { ui } from './state/ui.svelte';
import { updateWidget, widgetLines } from './platform/widget';
import './styles/app.css';

async function start(): Promise<void> {
  await ledger.init();

  // Apply preferences before the first paint; App.svelte keeps them in sync afterwards.
  applyTheme(ledger.settings.theme);
  // Always the phone's own language (one of the four, else English).
  await setLocale(detectLocale()).catch(() => undefined);

  mount(App, { target: document.getElementById('app')! });
  // An unreadable ledger was moved aside and a new one started: say so (Settings keeps the note).
  for (const file of ledger.setAside) ui.notify(t('storage.setAside', { file }), 'error');

  // Android back: close overlays, then return to the Entry tab, then exit.
  void CapacitorApp.addListener('backButton', () => {
    if (dismissOverlay()) return;
    if (!ui.back()) void CapacitorApp.exitApp();
  });
  const refreshWidget = () => updateWidget(widgetLines(ledger.entries, ledger.scoreOf, t, locale()));
  refreshWidget();
  ledger.onChange(refreshWidget);
  // Back up on the chosen schedule: when the app opens and whenever it comes back.
  void CapacitorApp.addListener('resume', () => {
    void backup.ifDue();
    refreshWidget();
  });
  // ledger:// links from Waymark and the other apps (style.md §14.1).
  void listenForLinks({
    add: (prefill) => ui.startEntry(prefill),
    entry: () => ui.go('entry'),
    share: (text) => ui.startShared(text),
  });
  void backup.ifDue();
}

void start();
