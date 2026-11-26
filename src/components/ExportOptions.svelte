<script lang="ts">
  import { t, type MessageKey } from '../i18n/index.svelte';
  import { exportAs, type ExportFormat } from '../state/transfer';
  import type { IconName } from '../domain/icons';
  import { ui } from '../state/ui.svelte';
  import Icon from './ui/Icon.svelte';

  interface Props {
    ondone?: () => void;
  }

  let { ondone }: Props = $props();
  let busy = $state<ExportFormat | null>(null);

  const FORMATS: { format: ExportFormat; key: MessageKey; hint: MessageKey; icon: IconName }[] = [
    { format: 'backup', key: 'data.backup', hint: 'data.backupHint', icon: 'archive' },
    { format: 'markdown', key: 'data.markdown', hint: 'data.markdownHint', icon: 'fileText' },
    { format: 'csv', key: 'data.csv', hint: 'data.csvHint', icon: 'table' },
  ];

  async function run(format: ExportFormat) {
    busy = format;
    const { message, ok } = await exportAs(format);
    busy = null;
    ui.notify(message, ok ? 'success' : 'error');
    if (ok) ondone?.();
  }
</script>

<!-- Settings rows (style.md §8.17), in Settings and in the export sheet. -->
<div class="settings-group export-options">
  {#each FORMATS as f (f.format)}
    <button type="button" class="settings-row" data-format={f.format} disabled={busy !== null} onclick={() => run(f.format)}>
      <span class="settings-row-icon"><Icon name={f.icon} size={20} /></span>
      <span class="settings-row-text">
        <span class="settings-row-title">{t(f.key)}{busy === f.format ? ' …' : ''}</span>
        <span class="settings-row-hint">{t(f.hint)}</span>
      </span>
      <Icon name="download" class="settings-row-chevron" />
    </button>
  {/each}
</div>
