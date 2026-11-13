<script lang="ts">
  import { Select } from 'dusk-dawn';
  import { EGGS, eggsFound } from '../lib/delight';
  import type { BackupFrequency, LanguageSetting, ThemeSetting } from '../domain/doc';
  import { LOCALES, LOCALE_NAMES, relativeTime, t, type MessageKey } from '../i18n/index.svelte';
  import { isNative } from '../platform/output';
  import { ledger } from '../state/ledger.svelte';
  import { backupNow, importFile } from '../state/transfer';
  import { folderSync } from '../state/sync.svelte';
  import { ui } from '../state/ui.svelte';
  import ExportOptions from './ExportOptions.svelte';
  import MetricsEditor from './MetricsEditor.svelte';

  const settings = $derived(ledger.settings);
  let importing = $state(false);
  let backingUp = $state(false);

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
    const result = await (action === 'choose' ? folderSync.choose() : folderSync.now());
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
    <MetricsEditor />
  </div>

  <div class="panel">
    <div class="section-head"><h2>{t('data.title')}</h2></div>

    <h3 class="t-section-label sub">{t('data.exportAs')}</h3>
    <ExportOptions />

    <h3 class="t-section-label sub">{t('data.import')}</h3>
    <p class="t-hint">{t('data.importHint')}</p>
    <label class="btn btn-secondary file-btn" class:busy={importing}>
      {t('action.import')}{importing ? ' …' : ''}
      <input type="file" id="importFile" class="visually-hidden" accept=".md,.json,.zip,text/markdown,text/plain,application/json,application/zip" disabled={importing} onchange={(e) => onImport(e.currentTarget)} />
    </label>

    <h3 class="t-section-label sub">{t('data.autoBackup')}</h3>
    {#if isNative}
      <p class="t-hint">{t('data.autoBackupHint')}</p>
      <div class="segmented" role="radiogroup" aria-label={t('data.autoBackup')}>
        {#each FREQUENCIES as opt (opt.value)}
          <button type="button" role="radio" aria-checked={settings.autoBackup === opt.value} onclick={() => update({ autoBackup: opt.value })}>
            {t(opt.key)}
          </button>
        {/each}
      </div>
      <label class="setting-row">
        <span class="t-field-label">{t('data.keep')}</span>
        <Select value={settings.keepBackups} options={KEEP.map((n) => ({ value: n, label: t('data.keepCount', { count: n }) }))} onchange={(keepBackups) => update({ keepBackups })} />
      </label>
      <div class="backup-row">
        <span class="t-hint">{t('data.lastBackup', { when: settings.lastBackupAt ? relativeTime(settings.lastBackupAt) : t('data.never') })}</span>
        <button type="button" class="btn btn-secondary" disabled={backingUp || !ledger.entries.length} onclick={runBackup}>{t('data.backupNow')}</button>
      </div>
      <p class="t-hint">{t('data.cloudNote')}</p>
    {:else}
      <p class="t-hint">{t('data.autoBackupWeb')}</p>
    {/if}

    <h3 class="t-section-label sub">{t('sync.title')}</h3>
    {#if isNative}
      <p class="t-hint">{t('sync.hint')}</p>
      {#if settings.syncFolder}
        <p class="t-hint" id="syncStatus">
          {t('sync.status', {
            folder: settings.syncFolder.name || '…',
            when: settings.lastSyncAt ? relativeTime(settings.lastSyncAt) : t('data.never'),
          })}
        </p>
        <div class="backup-row">
          <button type="button" class="btn btn-secondary" disabled={folderSync.busy} onclick={() => sync('now')}>{t('sync.now')}</button>
          <button type="button" class="btn btn-muted" disabled={folderSync.busy} onclick={() => sync('choose')}>{t('sync.change')}</button>
          <button type="button" class="btn btn-muted" disabled={folderSync.busy} onclick={() => folderSync.stop()}>{t('sync.stop')}</button>
        </div>
      {:else}
        <button type="button" class="btn btn-secondary" disabled={folderSync.busy} onclick={() => sync('choose')}>{t('sync.choose')}</button>
      {/if}
    {:else}
      <p class="t-hint">{t('sync.web')}</p>
    {/if}
  </div>

  <div class="panel about">
    <div class="section-head"><h2>{t('about.title')}</h2></div>
    <p class="t-hint">Ledger · {t('about.version', { version: __APP_VERSION__ })}</p>
    <p class="t-hint" id="eggCount">{t('about.eggs', { found: eggsFound(), total: EGGS.length })}</p>
    <p class="t-hint">{t('about.attribution')}</p>
  </div>
</div>

<style>
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .setting-row :global(.select) {
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
  .file-btn {
    position: relative;
    display: inline-flex;
  }
  .file-btn.busy {
    opacity: 0.6;
  }
  .backup-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }
  .t-hint {
    margin-bottom: 0.75rem;
  }
</style>
