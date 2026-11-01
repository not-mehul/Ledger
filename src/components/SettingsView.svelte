<script lang="ts">
  import type { BackupFrequency, LanguageSetting, ThemeSetting } from '../domain/doc';
  import { LOCALES, LOCALE_NAMES, relativeTime, t, type MessageKey } from '../i18n/index.svelte';
  import { isNative } from '../platform/output';
  import { ledger } from '../state/ledger.svelte';
  import { backupNow, importFile } from '../state/transfer';
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
      <select class="select" id="languageSelect" value={settings.language} onchange={(e) => update({ language: e.currentTarget.value as LanguageSetting })}>
        <option value="system">{t('settings.languageSystem')}</option>
        {#each LOCALES as code (code)}
          <option value={code}>{LOCALE_NAMES[code]}</option>
        {/each}
      </select>
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
        <select class="select" value={settings.keepBackups} onchange={(e) => update({ keepBackups: Number(e.currentTarget.value) })}>
          {#each KEEP as n (n)}
            <option value={n}>{t('data.keepCount', { count: n })}</option>
          {/each}
        </select>
      </label>
      <div class="backup-row">
        <span class="t-hint">{t('data.lastBackup', { when: settings.lastBackupAt ? relativeTime(settings.lastBackupAt) : t('data.never') })}</span>
        <button type="button" class="btn btn-secondary" disabled={backingUp || !ledger.entries.length} onclick={runBackup}>{t('data.backupNow')}</button>
      </div>
      <p class="t-hint">{t('data.cloudNote')}</p>
    {:else}
      <p class="t-hint">{t('data.autoBackupWeb')}</p>
    {/if}
  </div>

  <div class="panel about">
    <div class="section-head"><h2>{t('about.title')}</h2></div>
    <p class="t-hint">Ledger · {t('about.version', { version: __APP_VERSION__ })}</p>
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
  .setting-row select {
    width: auto;
    min-width: 12rem;
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
