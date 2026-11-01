<script lang="ts">
  import { detectLocale, locale, relativeTime, setLocale, t, type MessageKey } from './i18n/index.svelte';
  import { applyTheme, shown, toggledTheme } from './platform/theme.svelte';
  import { ledger } from './state/ledger.svelte';
  import { ui, type Tab } from './state/ui.svelte';
  import EntryForm from './components/EntryForm.svelte';
  import ExportOptions from './components/ExportOptions.svelte';
  import LedgerView from './components/LedgerView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import Sheet from './components/Sheet.svelte';
  import Modal from './components/ui/Modal.svelte';
  import TabRail from './components/ui/TabRail.svelte';
  import ThemeToggle from './components/ui/ThemeToggle.svelte';
  import Toast from './components/ui/Toast.svelte';

  type MainTab = Exclude<Tab, 'settings'>;
  const TABS: { id: MainTab; dom: string; panel: string; key: MessageKey }[] = [
    { id: 'entry', dom: 'tabNew', panel: 'viewNew', key: 'tabs.entry' },
    { id: 'ledger', dom: 'tabLogbook', panel: 'viewLogbook', key: 'tabs.ledger' },
    { id: 'map', dom: 'tabMap', panel: 'viewMap', key: 'tabs.map' },
    { id: 'insights', dom: 'tabInsights', panel: 'viewInsights', key: 'tabs.insights' },
  ];
  const tabs = $derived(
    TABS.map((tab) => ({
      id: tab.id,
      domId: tab.dom,
      controls: tab.panel,
      label: t(tab.key),
      badge: tab.id === 'ledger' ? ledger.entries.length : undefined,
    })),
  );
  const today = $derived(new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }));

  async function toggleTheme() {
    try {
      await ledger.updateSettings({ theme: toggledTheme() });
    } catch (err) {
      console.error('Saving settings failed:', err);
      ui.notify(t('toast.saveFailed'), 'error');
    }
  }

  $effect(() => applyTheme(ledger.settings.theme));
  $effect(() => {
    const lang = ledger.settings.language;
    const next = lang === 'system' ? detectLocale() : lang;
    if (next !== locale()) void setLocale(next);
  });

  const status = $derived.by(() => {
    if (ledger.status === 'loading') return t('status.loading');
    if (ledger.status === 'failed') return t('status.unavailable');
    const count = t('status.entries', { count: ledger.entries.length });
    const last = ledger.settings.lastBackupAt;
    return last ? `${count} · ${t('status.backedUp', { when: relativeTime(last) })}` : count;
  });
</script>

<div class="glow-layer" aria-hidden="true">
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>
  <div class="glow glow-3"></div>
</div>

<div class="container">
  <header class="site-header">
    <div class="site-title">
      <p class="eyebrow">{today}</p>
      <h1 class="t-page-title"><em>Ledger</em></h1>
      <p class="t-tagline">{t('app.tagline')}</p>
    </div>
    <ThemeToggle dawn={!shown.dark} label={t('settings.dawnSwitch')} ontoggle={() => void toggleTheme()} />
  </header>

  <div class="file-bar">
    <div class="file-dot" class:connected={ledger.status === 'ready'} id="fileDot" aria-hidden="true"></div>
    <span class="file-status" class:connected={ledger.status === 'ready'} id="fileStatus" role="status">{status}</span>
    <button type="button" class="btn btn-secondary" id="btnExport" onclick={() => (ui.exportOpen = true)}>{t('action.export')}</button>
    <button
      type="button"
      class="btn-icon"
      class:active={ui.tab === 'settings'}
      id="tabSettings"
      aria-label={t('tabs.settings')}
      aria-pressed={ui.tab === 'settings'}
      onclick={() => ui.go(ui.tab === 'settings' ? 'entry' : 'settings')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  </div>

  <nav class="app-tabs">
    <TabRail {tabs} value={ui.tab === 'settings' ? ('' as MainTab) : ui.tab} label={t('tabs.sections')} onselect={(id) => ui.go(id)} />
  </nav>

  <!-- The form stays mounted so a half-filled entry survives tab switches. -->
  <div hidden={ui.tab !== 'entry'}><EntryForm /></div>
  {#if ui.tab === 'ledger'}
    <LedgerView />
  {:else if ui.tab === 'map'}
    <!-- d3 and the map shapes load only when the map is opened. -->
    {#await import('./components/MapView.svelte') then { default: MapView }}
      <MapView />
    {/await}
  {:else if ui.tab === 'insights'}
    {#await import('./components/insights/InsightsView.svelte') then { default: InsightsView }}
      <InsightsView />
    {/await}
  {:else if ui.tab === 'settings'}
    <SettingsView />
  {/if}
</div>

{#if ui.exportOpen}
  <Sheet title={t('export.title')} onclose={() => (ui.exportOpen = false)}>
    <ExportOptions ondone={() => (ui.exportOpen = false)} />
  </Sheet>
{/if}

{#if ui.confirmRequest}
  {@const request = ui.confirmRequest}
  <Modal title={request.title} closeLabel={t('action.close')} onclose={() => request.resolve(false)}>
    <p class="t-body-small">{request.message}</p>
    <div class="btn-row">
      <button type="button" class="btn btn-muted" onclick={() => request.resolve(false)}>{t('action.cancel')}</button>
      <button type="button" class="btn {request.danger ? 'btn-danger' : 'btn-primary'}" id="confirmAction" onclick={() => request.resolve(true)}>
        {request.action}
      </button>
    </div>
  </Modal>
{/if}

<Toast
  toast={ui.toast}
  onpause={() => ui.pauseToast()}
  onresume={() => ui.resumeToast()}
  onaction={() => ui.actOnToast()}
/>

<style>
  .btn-icon.active {
    color: var(--accent-amber);
  }
</style>
