<script lang="ts">
  import { t, type MessageKey } from '../i18n/index.svelte';
  import { exportAs, type ExportFormat } from '../state/transfer';
  import { ui } from '../state/ui.svelte';

  interface Props {
    ondone?: () => void;
  }

  let { ondone }: Props = $props();
  let busy = $state<ExportFormat | null>(null);

  const FORMATS: { format: ExportFormat; key: MessageKey }[] = [
    { format: 'markdown', key: 'data.markdown' },
    { format: 'csv', key: 'data.csv' },
    { format: 'json', key: 'data.json' },
    { format: 'backup', key: 'data.backup' },
  ];

  async function run(format: ExportFormat) {
    busy = format;
    const { message, ok } = await exportAs(format);
    busy = null;
    ui.notify(message, ok ? 'success' : 'error');
    if (ok) ondone?.();
  }
</script>

<div class="export-options">
  {#each FORMATS as f (f.format)}
    <button type="button" class="btn btn-secondary" data-format={f.format} disabled={busy !== null} onclick={() => run(f.format)}>
      {t(f.key)}{busy === f.format ? ' …' : ''}
    </button>
  {/each}
</div>

<style>
  .export-options {
    display: grid;
    gap: 0.5rem;
  }
  .export-options .btn {
    text-align: left;
    white-space: normal;
    line-height: 1.5;
    padding: 0.75rem 1rem;
  }
</style>
