<script lang="ts">
  import type { Snippet } from 'svelte';
  import { detectLocale, locale, relativeTime, setLocale, t, type MessageKey } from './i18n/index.svelte';
  import { applyTheme } from './platform/theme';
  import { ledger } from './state/ledger.svelte';
  import { ui, type Tab } from './state/ui.svelte';
  import EntryForm from './components/EntryForm.svelte';
  import IdleStamp from './components/IdleStamp.svelte';
  import LedgerView from './components/LedgerView.svelte';
  import IdleDock from './components/ui/IdleDock.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import Modal from './components/ui/Modal.svelte';
  import Icon from './components/ui/Icon.svelte';
  import { IconTabs, Toast, konami, markStuck, play, secretTaps } from 'dusk-dawn';
  import { cheer, hatch } from './lib/delight';

  type MainTab = Exclude<Tab, 'settings'>;
  const TABS: { id: MainTab; dom: string; panel: string; key: MessageKey; icon: Snippet }[] = [
    { id: 'entry', dom: 'tabNew', panel: 'viewNew', key: 'tabs.entry', icon: entryIcon },
    { id: 'ledger', dom: 'tabLogbook', panel: 'viewLogbook', key: 'tabs.ledger', icon: ledgerIcon },
    { id: 'map', dom: 'tabMap', panel: 'viewMap', key: 'tabs.map', icon: mapIcon },
    { id: 'insights', dom: 'tabInsights', panel: 'viewInsights', key: 'tabs.insights', icon: insightsIcon },
  ];
  const tabs = $derived(
    TABS.map((tab) => ({
      id: tab.id,
      domId: tab.dom,
      controls: tab.panel,
      label: t(tab.key),
      icon: tab.icon,
    })),
  );
  const today = $derived(new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }));

  $effect(() => applyTheme(ledger.settings.theme));
  // Always the phone's own language (one of the four, else English).
  $effect(() => {
    const next = detectLocale();
    if (next !== locale()) void setLocale(next);
  });

  const status = $derived.by(() => {
    if (ledger.status === 'loading') return t('status.loading');
    if (ledger.status === 'failed') return t('status.unavailable');
    const count = t('status.entries', { count: ledger.entries.length });
    const last = ledger.settings.lastBackupAt;
    return last ? `${count} · ${t('status.backedUp', { when: relativeTime(last) })}` : count;
  });

  // Easter eggs (style.md §11.3). The Konami code stamps the passport; seven
  // taps on the title set every dial on the page spinning.
  let titleWord = $state<HTMLElement>();
  $effect(() =>
    konami(() => {
      play(titleWord, 'tada');
      cheer(null, { count: 80, spread: 1.3 });
      hatch('konami', t('egg.konami'));
    }),
  );
  function wanderlust() {
    play(titleWord, 'jelly');
    for (const [i, dial] of [...document.querySelectorAll('.score-dial')].slice(0, 24).entries()) setTimeout(() => play(dial, 'spin-once'), 40 * i);
    hatch('title', t('egg.title'));
  }
</script>

{#snippet entryIcon()}<Icon name="pin" size={22} />{/snippet}
{#snippet ledgerIcon()}<Icon name="book" size={22} />{/snippet}
{#snippet mapIcon()}<Icon name="map" size={22} />{/snippet}
{#snippet insightsIcon()}<Icon name="chart" size={22} />{/snippet}

<div class="glow-layer" aria-hidden="true">
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>
  <div class="glow glow-3"></div>
</div>

<div class="container">
  {#snippet actions()}
    <button type="button" class="btn-icon" id="tabSettings" aria-label={t('tabs.settings')} title={t('tabs.settings')} onclick={() => ui.go('settings')}><Icon name="settings" size={20} /></button>
  {/snippet}

  <!-- Storage state, for screen readers always and on screen only when something is wrong. -->
  <span class="visually-hidden" class:connected={ledger.status === 'ready'} id="fileStatus" role="status">{status}</span>

  {#if ui.tab === 'settings'}
    <!-- A secondary screen (style.md §8.8): back, title, no tabs. -->
    <header class="screen-header">
      <button type="button" class="btn-icon screen-header-back" id="settingsBack" aria-label={t('action.back')} onclick={() => ui.closeSettings()}><Icon name="chevronLeft" size={22} /></button>
      <h1 class="screen-header-title">{t('tabs.settings')}</h1>
    </header>
  {:else if ui.tab === 'entry'}
    <header class="site-header">
      <div class="site-title">
        <p class="eyebrow">{today}</p>
        <h1 class="t-page-title" use:secretTaps={{ count: 7, onunlock: wanderlust }}><em class="title-word" bind:this={titleWord}>Ledger</em></h1>
        <p class="t-tagline">{t('app.tagline')}</p>
      </div>
      <div class="site-actions">
        <div class="screen-header-actions">{@render actions()}</div>
      </div>
    </header>
  {:else}
    <!-- After the first section, one line (style.md §8.8), so the page starts with its content. -->
    <header class="screen-header">
      <p class="screen-header-title"><em>Ledger</em></p>
      <div class="screen-header-actions">{@render actions()}</div>
    </header>
  {/if}

  {#if ledger.status === 'failed'}
    <p class="notice is-error" role="alert" id="storageNotice">{t('status.unavailable')}</p>
  {/if}

  {#if ui.tab !== 'settings'}
    <nav class="app-tabs tab-bar-sticky" use:markStuck>
      <IconTabs {tabs} value={ui.tab} label={t('tabs.sections')} onselect={(id) => ui.go(id)} />
    </nav>
  {/if}

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

<IdleDock label={t('idle.label')} disabled={ui.compareOpen || !!ui.confirmRequest}><IdleStamp /></IdleDock>

<Toast
  toast={ui.toast}
  onpause={() => ui.pauseToast()}
  onresume={() => ui.resumeToast()}
  onaction={() => ui.actOnToast()}
/>

<style>
  .site-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-3);
  }
</style>
