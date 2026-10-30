<script lang="ts">
  import { detectLocale, locale, relativeTime, setLocale, t, type MessageKey } from './i18n/index.svelte';
  import { applyTheme } from './platform/theme';
  import { ledger } from './state/ledger.svelte';
  import { ui, type Tab } from './state/ui.svelte';
  import EntryForm from './components/EntryForm.svelte';
  import ExportOptions from './components/ExportOptions.svelte';
  import LedgerView from './components/LedgerView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import Sheet from './components/Sheet.svelte';

  const TABS: { id: Tab; dom: string; key: MessageKey }[] = [
    { id: 'entry', dom: 'tabNew', key: 'tabs.entry' },
    { id: 'ledger', dom: 'tabLogbook', key: 'tabs.ledger' },
    { id: 'map', dom: 'tabMap', key: 'tabs.map' },
    { id: 'settings', dom: 'tabSettings', key: 'tabs.settings' },
  ];

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
    <h1><em>Ledger</em></h1>
    <p>{t('app.tagline')}</p>
  </header>

  <div class="file-bar">
    <div class="file-dot" class:connected={ledger.status === 'ready'} id="fileDot" aria-hidden="true"></div>
    <span class="file-status" class:connected={ledger.status === 'ready'} id="fileStatus" role="status">{status}</span>
    <button type="button" class="btn btn-ghost" id="btnExport" onclick={() => (ui.exportOpen = true)}>{t('action.export')}</button>
  </div>

  <div class="tab-nav" role="tablist" aria-label="Sections">
    {#each TABS as tab (tab.id)}
      <button
        type="button"
        class="tab-btn"
        class:active={ui.tab === tab.id}
        id={tab.dom}
        role="tab"
        aria-selected={ui.tab === tab.id}
        onclick={() => ui.go(tab.id)}
      >
        {t(tab.key)}
        {#if tab.id === 'ledger'}<span class="tab-badge" id="entryBadge">{ledger.entries.length}</span>{/if}
      </button>
    {/each}
  </div>

  <!-- The form stays mounted so a half-filled entry survives tab switches. -->
  <div hidden={ui.tab !== 'entry'}><EntryForm /></div>
  {#if ui.tab === 'ledger'}
    <LedgerView />
  {:else if ui.tab === 'map'}
    <!-- d3 and the map shapes load only when the map is opened. -->
    {#await import('./components/MapView.svelte') then { default: MapView }}
      <MapView />
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

{#if ui.toast}
  {#key ui.toast.key}
    <div class="toast show {ui.toast.kind === 'info' ? '' : ui.toast.kind}" id="toast" role="status" aria-live="polite">
      {ui.toast.message}
    </div>
  {/key}
{:else}
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
{/if}
