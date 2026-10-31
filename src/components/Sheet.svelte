<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../i18n/index.svelte';
  import { ui } from '../state/ui.svelte';

  interface Props {
    title: string;
    onclose: () => void;
    children: Snippet;
  }

  let { title, onclose, children }: Props = $props();
  let dialog: HTMLDialogElement;

  $effect(() => {
    dialog.showModal();
    return ui.pushOverlay(onclose);
  });
</script>

<dialog
  bind:this={dialog}
  class="sheet"
  aria-label={title}
  onclose={onclose}
  onclick={(e) => {
    if (e.target === dialog) onclose();
  }}
>
  <div class="sheet-body">
    <div class="sheet-head">
      <h2>{title}</h2>
      <button type="button" class="btn btn-ghost" onclick={onclose}>{t('action.close')}</button>
    </div>
    {@render children()}
  </div>
</dialog>

<style>
  .sheet {
    margin: auto auto 0;
    width: min(100%, 560px);
    max-height: 85dvh;
    border: 1px solid var(--border-soft);
    border-bottom: none;
    background: var(--bg-grad-mid);
    color: var(--text-body);
    padding: 0;
  }
  .sheet::backdrop {
    background: rgba(0, 0, 0, 0.55);
  }
  .sheet-body {
    padding: 1.25rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
  }
  .sheet-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  h2 {
    font-family: var(--font-serif);
    font-style: italic;
    font-weight: 400;
    font-size: 1.5rem;
    color: var(--text-heading);
  }
</style>
