<script lang="ts">
  // style.md §8.11: rises from the bottom on phones, a modal from 900px up.
  import type { Snippet } from 'svelte';
  import { t } from '../i18n/index.svelte';
  import { ui } from '../state/ui.svelte';
  import Icon from './ui/Icon.svelte';

  interface Props {
    title: string;
    onclose: () => void;
    children: Snippet;
  }

  let { title, onclose, children }: Props = $props();
  let dialog: HTMLDialogElement;
  let dragFrom: number | null = null;
  let drag = $state(0);
  let dragging = $state(false);

  $effect(() => {
    dialog.showModal();
    return ui.pushOverlay(onclose);
  });

  // Swipe down on the handle or the header to dismiss.
  function start(e: PointerEvent) {
    if (e.button !== 0 || (e.target as Element).closest('button')) return;
    dragFrom = e.clientY;
    dragging = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (dragFrom !== null) drag = Math.max(0, e.clientY - dragFrom);
  }
  function end() {
    if (dragFrom === null) return;
    dragFrom = null;
    dragging = false;
    if (drag > 80) onclose();
    // Short of the threshold, the sheet settles back instead of jumping.
    drag = 0;
  }
</script>

<dialog
  bind:this={dialog}
  class="sheet"
  aria-labelledby="sheet-title"
  class:dragging
  style:transform={drag ? `translateY(${drag}px)` : undefined}
  style:--sheet-dim={drag ? Math.max(0.35, 1 - drag / 320) : undefined}
  onclose={onclose}
  onclick={(e) => {
    if (e.target === dialog) onclose();
  }}
>
  <div class="sheet-grip" onpointerdown={start} onpointermove={move} onpointerup={end} onpointercancel={end} role="presentation">
    <div class="sheet-handle" aria-hidden="true"></div>
    <div class="sheet-head">
      <h2 class="sheet-title" id="sheet-title">{title}</h2>
      <button type="button" class="btn-icon sheet-close" aria-label={t('action.close')} title={t('action.close')} onclick={onclose}><Icon name="x" size={20} /></button>
    </div>
  </div>
  <div class="sheet-body">
    {@render children()}
  </div>
</dialog>

<style>
  .sheet-grip {
    touch-action: none;
    cursor: grab;
  }
  .sheet {
    transition: transform var(--dur-settle) var(--ease-settle);
  }
  .sheet.dragging {
    transition: none;
  }
  /* The page shows through a little more as the sheet is pulled down. */
  .sheet::backdrop {
    opacity: var(--sheet-dim, 1);
  }
</style>
