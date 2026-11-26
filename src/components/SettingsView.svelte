<script lang="ts">
  import Icon from './ui/Icon.svelte';
  import { EGGS, eggsFound } from '../lib/delight';
  import type { BackupFrequency, ThemeSetting } from '../domain/doc';
  import { relativeTime, t, type MessageKey } from '../i18n/index.svelte';
  import { ledger } from '../state/ledger.svelte';
  import { restoreFile } from '../state/transfer';
  import { backup } from '../state/backup.svelte';
  import { ui } from '../state/ui.svelte';
  import MetricsEditor from './MetricsEditor.svelte';
  import Sheet from './Sheet.svelte';

  const settings = $derived(ledger.settings);
  let restoring = $state(false);
  let metricsOpen = $state(false);
  const metricCount = $derived(ledger.config.metrics.filter((m) => !m.archived && !ledger.config.categories.find((c) => c.id === m.cat)?.archived).length);
  const hiddenCount = $derived(ledger.config.metrics.length - metricCount);

  const THEMES: { value: ThemeSetting; key: MessageKey }[] = [
    { value: 'system', key: 'settings.themeSystem' },
    { value: 'dark', key: 'settings.themeDusk' },
    { value: 'light', key: 'settings.themeDawn' },
  ];
  const EVERY: { value: BackupFrequency; key: MessageKey }[] = [
    { value: 'daily', key: 'backup.daily' },
    { value: 'weekly', key: 'backup.weekly' },
    { value: 'monthly', key: 'backup.monthly' },
    { value: 'off', key: 'backup.off' },
  ];

  async function update(patch: Parameters<typeof ledger.updateSettings>[0]) {
    try {
      await ledger.updateSettings(patch);
    } catch (err) {
      console.error('Saving settings failed:', err);
      ui.notify(t('toast.saveFailed'), 'error');
    }
  }

  // The backup's own status line (as BookShelf has it): what just happened,
  // else how the last backup went.
  let notice = $state<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const standing = $derived.by(() => {
    if (!settings.syncFolder) return null;
    if (settings.backupFailedAt) return { text: t('backup.lastFailed', { when: relativeTime(settings.backupFailedAt) }), kind: 'err' as const };
    if (settings.lastBackupAt) return { text: t('backup.last', { when: relativeTime(settings.lastBackupAt) }), kind: 'ok' as const };
    return null;
  });
  const shownNotice = $derived(notice ?? standing);

  async function backUp() {
    notice = { text: t('backup.working'), kind: 'ok' };
    try {
      const { brought } = await backup.now();
      notice = { text: brought ? t('backup.doneBrought', { count: brought }) : t('backup.done'), kind: 'ok' };
    } catch (err) {
      console.error('Backup failed:', err);
      notice = { text: t('backup.failed'), kind: 'err' };
    }
  }

  async function choose() {
    try {
      if (await backup.choose()) await backUp();
    } catch (err) {
      console.error('Choosing a folder failed:', err);
      notice = { text: t('backup.failed'), kind: 'err' };
    }
  }

  async function stop() {
    await backup.stop();
    notice = null;
  }

  async function onRestore(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    restoring = true;
    const { message, ok } = await restoreFile(file);
    restoring = false;
    ui.notify(message, ok ? 'success' : 'error');
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

  <!-- Backup, as BookShelf has it: the folder, how often, back up now or stop. -->
  <div class="panel" id="backupSection">
    <div class="section-head"><h2>{t('backup.title')}</h2></div>
    <p class="t-hint">{t('backup.hint')}</p>
    <div class="settings-group">
      <div class="settings-row">
        <span class="settings-row-icon"><Icon name="folder" size={20} /></span>
        <span class="settings-row-text">
          <span class="settings-row-title">{t('backup.folder')}</span>
          <span class="settings-row-hint" id="backupFolder">{settings.syncFolder ? settings.syncFolder.name || '…' : t('backup.notChosen')}</span>
        </span>
        <button type="button" class="btn btn-muted" id="btnChooseFolder" disabled={backup.busy} onclick={choose}>
          {settings.syncFolder ? t('backup.change') : t('backup.choose')}
        </button>
      </div>
    </div>

    <span class="t-field-label every-label" id="backupEveryLabel">{t('backup.every')}</span>
    <div class="segmented full" role="radiogroup" aria-labelledby="backupEveryLabel">
      {#each EVERY as opt (opt.value)}
        <button type="button" role="radio" aria-checked={settings.autoBackup === opt.value} data-every={opt.value} onclick={() => update({ autoBackup: opt.value })}>
          {t(opt.key)}
        </button>
      {/each}
    </div>
    <p class="t-hint">{settings.autoBackup === 'off' ? t('backup.onlyNow') : t('backup.whenDue')}</p>

    {#if settings.syncFolder}
      <div class="backup-actions">
        <button type="button" class="btn btn-muted" id="btnStopBackup" onclick={stop}>{t('backup.stop')}</button>
        <button type="button" class="btn btn-primary" id="btnBackupNow" disabled={backup.busy} onclick={backUp}>{t('backup.now')}</button>
      </div>
    {/if}
    <p class="t-hint backup-notice" class:warning={shownNotice?.kind === 'err'} id="backupNotice" role="status" aria-live="polite">{shownNotice?.text ?? ''}</p>
  </div>

  <div class="panel">
    <div class="section-head"><h2>{t('data.title')}</h2></div>
    {#each ledger.setAside as file (file)}
      <p class="t-hint warning" id="setAsideNotice">{t('storage.setAside', { file })}</p>
    {/each}
    <div class="settings-group">
      <div class="settings-row">
        <span class="settings-row-icon"><Icon name="upload" size={20} /></span>
        <span class="settings-row-text">
          <span class="settings-row-title">{t('restore.title')}</span>
          <span class="settings-row-hint">{t('restore.hint')}</span>
        </span>
        <!-- The button is the file picker's label. -->
        <label class="btn btn-muted file-button" class:busy={restoring}>
          {restoring ? t('restore.working') : t('restore.button')}
          <input type="file" id="importFile" class="visually-hidden" accept=".json,.zip,application/json,application/zip" disabled={restoring} onchange={(e) => onRestore(e.currentTarget)} />
        </label>
      </div>
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
  .t-hint {
    margin-bottom: 0.75rem;
  }
  .every-label {
    display: block;
    margin: 1.25rem 0 0.5rem;
  }
  /* One row sharing the width evenly, as BookShelf's: never wraps to a second line. */
  .segmented.full {
    display: flex;
    flex-wrap: nowrap;
    width: 100%;
    margin-bottom: 0.5rem;
  }
  .segmented.full > button {
    flex: 1 1 0;
    min-width: 0;
    padding-inline: 0.5rem;
  }
  .backup-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .backup-notice {
    min-height: 1.25rem;
    margin: 0.75rem 0 0;
  }
  .file-button {
    flex-shrink: 0;
    cursor: pointer;
  }
  .file-button:focus-within {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .file-button.busy {
    opacity: 0.6;
  }
</style>
