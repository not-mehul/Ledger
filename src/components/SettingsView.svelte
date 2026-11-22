<script lang="ts">
  import Icon from './ui/Icon.svelte';
  import { Select } from 'dusk-dawn';
  import { EGGS, eggsFound } from '../lib/delight';
  import type { BackupFrequency, LanguageSetting, ThemeSetting } from '../domain/doc';
  import { LOCALES, LOCALE_NAMES, relativeTime, t, type MessageKey } from '../i18n/index.svelte';
  import { ledger } from '../state/ledger.svelte';
  import { backupNow, importFile } from '../state/transfer';
  import { folderSync } from '../state/sync.svelte';
  import { ui } from '../state/ui.svelte';
  import ExportOptions from './ExportOptions.svelte';
  import MetricsEditor from './MetricsEditor.svelte';
  import Sheet from './Sheet.svelte';

  const settings = $derived(ledger.settings);
  let importing = $state(false);
  let backingUp = $state(false);
  let metricsOpen = $state(false);
  const metricCount = $derived(ledger.config.metrics.filter((m) => !m.archived && !ledger.config.categories.find((c) => c.id === m.cat)?.archived).length);
  const hiddenCount = $derived(ledger.config.metrics.length - metricCount);

  const THEMES: { value: ThemeSetting; key: MessageKey }[] = [
    { value: 'system', key: 'settings.themeSystem' },
    { value: 'dark', key: 'settings.themeDusk' },
    { value: 'light', key: 'settings.themeDawn' },
  ];
  const FREQUENCIES: { value: BackupFrequency; key: MessageKey }[] = [
    { value: 'off', key: 'data.freqOff' },
    { value: 'daily', key: 'data.freqDaily' },
    { value: 'weekly', key: 'data.freqWeekly' },
    { value: 'monthly', key: 'data.freqMonthly' },
  ];
  const KEEP = [3, 5, 10, 20];

  async function update(patch: Parameters<typeof ledger.updateSettings>[0]) {
    try {
      await ledger.updateSettings(patch);
    } catch (err) {
      console.error('Saving settings failed:', err);
      ui.notify(t('toast.saveFailed'), 'error');
    }
  }

  async function onImport(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    importing = true;
    const { message, ok } = await importFile(file);
    importing = false;
    ui.notify(message, ok ? 'success' : 'error');
  }

  async function sync(action: 'choose' | 'now') {
    let result: Awaited<ReturnType<typeof folderSync.now>>;
    try {
      result = await (action === 'choose' ? folderSync.choose() : folderSync.now());
    } catch (err) {
      console.error('Sync failed', err);
      result = 'failed';
    }
    if (result === 'synced') ui.notify(t('sync.done'), 'success');
    else if (result === 'failed') ui.notify(t('sync.failed'), 'error');
  }

  async function runBackup() {
    backingUp = true;
    try {
      ui.notify(t('export.backupSaved', { path: await backupNow() }), 'success');
    } catch (err) {
      console.error('Backup failed:', err);
      ui.notify(t('export.backupFailed'), 'error');
    } finally {
      backingUp = false;
    }
  }
</script>

<div id="viewSettings" role="tabpanel" aria-labelledby="tabSettings">
  <div class="panel">
    <div class="section-head"><h2>{t('settings.appearance')}</h2></div>
    <div class="setting-row">
      <span class="t-field-label" id="themeLabel">{t('settings.theme')}</span>
      <div class="segmented" role="radiogroup" aria-labelledby="themeLabel">
        {#each THEMES as opt (opt.value)}
          <button type="button" role="radio" aria-checked={settings.theme === opt.value} data-theme-option={opt.value} onclick={() => update({ theme: opt.value })}>
            {t(opt.key)}
          </button>
        {/each}
      </div>
    </div>
    <label class="setting-row">
      <span class="t-field-label">{t('settings.language')}</span>
      <Select
        id="languageSelect"
        value={settings.language}
        options={[
          { value: 'system' as LanguageSetting, label: t('settings.languageSystem') },
          ...LOCALES.map((code) => ({ value: code as LanguageSetting, label: LOCALE_NAMES[code] })),
        ]}
        onchange={(language) => update({ language })}
      />
    </label>
  </div>

  <div class="panel">
    <div class="section-head"><h2>{t('metrics.title')}</h2></div>
    <div class="settings-group">
      <button type="button" class="settings-row" id="metricsEditor" aria-haspopup="dialog" onclick={() => (metricsOpen = true)}>
        <span class="settings-row-icon"><Icon name="chart" size={20} /></span>
        <span class="settings-row-text">
          <span class="settings-row-title">{t('metrics.edit')}</span>
          <span class="settings-row-hint">{t('metrics.count', { count: metricCount })}{hiddenCount ? ` · ${t('metrics.hiddenCount', { count: hiddenCount })}` : ''}</span>
        </span>
        <Icon name="chevronRight" class="settings-row-chevron" />
      </button>
    </div>
  </div>
  {#if metricsOpen}
    <Sheet title={t('metrics.title')} onclose={() => (metricsOpen = false)}>
      <MetricsEditor />
    </Sheet>
  {/if}

  <div class="panel">
    <div class="section-head"><h2>{t('data.title')}</h2></div>

    <h3 class="t-section-label sub">{t('data.exportAs')}</h3>
    <ExportOptions />

    <h3 class="t-section-label sub">{t('data.import')}</h3>
    {#each ledger.setAside as file (file)}
      <p class="t-hint warning" id="setAsideNotice">{t('storage.setAside', { file })}</p>
    {/each}
    <div class="settings-group">
      <!-- The whole row opens the file picker. -->
      <label class="settings-row file-row" class:busy={importing}>
        <span class="settings-row-icon"><Icon name="upload" size={20} /></span>
        <span class="settings-row-text">
          <span class="settings-row-title">{t('data.importRow')}{importing ? ' …' : ''}</span>
          <span class="settings-row-hint">{t('data.importShort')}</span>
        </span>
        <Icon name="chevronRight" class="settings-row-chevron" />
        <input type="file" id="importFile" class="visually-hidden" accept=".md,.json,.zip,text/markdown,text/plain,application/json,application/zip" disabled={importing} onchange={(e) => onImport(e.currentTarget)} />
      </label>
    </div>

    <h3 class="t-section-label sub">{t('data.autoBackup')}</h3>
    <p class="t-hint">{t('data.autoBackupHint')}</p>
    <div class="segmented" role="radiogroup" aria-label={t('data.autoBackup')}>
      {#each FREQUENCIES as opt (opt.value)}
        <button type="button" role="radio" aria-checked={settings.autoBackup === opt.value} onclick={() => update({ autoBackup: opt.value })}>
          {t(opt.key)}
        </button>
      {/each}
    </div>
    <div class="settings-group">
      <label class="settings-row">
        <span class="settings-row-text"><span class="settings-row-title">{t('data.keep')}</span></span>
        <Select value={settings.keepBackups} options={KEEP.map((n) => ({ value: n, label: t('data.keepCount', { count: n }) }))} onchange={(keepBackups) => update({ keepBackups })} />
      </label>
      <div class="settings-row">
        <span class="settings-row-text">
          <span class="settings-row-title" id="lastBackup">{t('data.lastBackup', { when: settings.lastBackupAt ? relativeTime(settings.lastBackupAt) : t('data.never') })}</span>
        </span>
        <!-- The one primary action in this section (style.md §8.17). -->
        <button type="button" class="btn btn-primary" disabled={backingUp || !ledger.entries.length} onclick={runBackup}>{t('data.backupNow')}</button>
      </div>
    </div>

    <p class="t-hint">{t('data.cloudNote')}</p>

    <h3 class="t-section-label sub">{t('sync.title')}</h3>
    <p class="t-hint">{t('sync.hint')}</p>
    {#if folderSync.failedAt}
      <p class="t-hint warning" id="syncFailed">{t('sync.lastFailed', { when: relativeTime(folderSync.failedAt) })}</p>
    {/if}
    <div class="settings-group">
      {#if settings.syncFolder}
        <button type="button" class="settings-row" id="syncStatus" disabled={folderSync.busy} onclick={() => sync('now')}>
          <span class="settings-row-icon"><Icon name="refresh" size={20} /></span>
          <span class="settings-row-text">
            <span class="settings-row-title">{t('sync.now')}</span>
            <span class="settings-row-hint">
              {t('sync.statusRow', { folder: settings.syncFolder.name || '…' })} · {t('sync.lastSynced', { when: settings.lastSyncAt ? relativeTime(settings.lastSyncAt) : t('data.never') })}
            </span>
          </span>
        </button>
        <button type="button" class="settings-row" disabled={folderSync.busy} onclick={() => sync('choose')}>
          <span class="settings-row-icon"><Icon name="folder" size={20} /></span>
          <span class="settings-row-text"><span class="settings-row-title">{t('sync.change')}</span></span>
          <Icon name="chevronRight" class="settings-row-chevron" />
        </button>
        <button type="button" class="settings-row" disabled={folderSync.busy} onclick={() => folderSync.stop()}>
          <span class="settings-row-icon"><Icon name="x" size={20} /></span>
          <span class="settings-row-text"><span class="settings-row-title">{t('sync.stop')}</span></span>
        </button>
      {:else}
        <button type="button" class="settings-row" disabled={folderSync.busy} onclick={() => sync('choose')}>
          <span class="settings-row-icon"><Icon name="folder" size={20} /></span>
          <span class="settings-row-text"><span class="settings-row-title">{t('sync.choose')}</span></span>
          <Icon name="chevronRight" class="settings-row-chevron" />
        </button>
      {/if}
    </div>
  </div>

  <div class="panel about">
    <div class="section-head"><h2>{t('about.title')}</h2></div>
    <p class="t-hint" id="aboutVersion">Ledger · {t('about.version', { version: __APP_VERSION__ })} · {t('app.designedBy')}</p>
    <p class="t-hint" id="eggCount">{t('about.eggs', { found: eggsFound(), total: EGGS.length })}</p>
    <p class="t-hint">{t('about.attribution')}</p>
  </div>
</div>

<style>
  .warning {
    color: var(--danger);
  }
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .setting-row :global(.select),
  .settings-row :global(.select) {
    width: auto;
    min-width: min(12rem, 100%);
  }
  .segmented {
    margin-bottom: 1rem;
  }
  .sub {
    margin: 1.5rem 0 0.75rem;
  }
  .sub:first-of-type {
    margin-top: 0;
  }
  .file-row {
    cursor: pointer;
    border-radius: var(--corner-sm);
  }
  .file-row:hover {
    background: var(--hover-bg);
  }
  .file-row:focus-within {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .file-row.busy {
    opacity: 0.6;
  }
  .t-hint {
    margin-bottom: 0.75rem;
  }
</style>
