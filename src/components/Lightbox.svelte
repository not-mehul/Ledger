<script lang="ts">
  import type { Photo } from '../domain/entry';
  import { t } from '../i18n/index.svelte';
  import { ui } from '../state/ui.svelte';
  import PhotoImg from './PhotoImg.svelte';

  interface Props {
    photos: Photo[];
    index: number;
    onclose: () => void;
  }

  let { photos, index = $bindable(), onclose }: Props = $props();
  let startX: number | null = null;
  /** The photo follows the finger while swiping. */
  let dx = $state(0);

  const step = (d: number) => (index = (index + d + photos.length) % photos.length);

  $effect(() => ui.pushOverlay(onclose));

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  }
</script>

<svelte:window {onkeydown} />

<div
  class="lightbox"
  role="dialog"
  aria-modal="true"
  aria-label={t('ledger.photo', { n: index + 1, total: photos.length })}
  tabindex="-1"
  onpointerdown={(e) => (startX = e.clientX)}
  onpointermove={(e) => {
    if (startX !== null && photos.length > 1) dx = e.clientX - startX;
  }}
  onpointerup={(e) => {
    const moved = startX === null ? 0 : e.clientX - startX;
    startX = null;
    dx = 0;
    if (Math.abs(moved) > 50 && photos.length > 1) step(moved < 0 ? 1 : -1);
  }}
  onpointercancel={() => {
    startX = null;
    dx = 0;
  }}
>
  {#key photos[index]?.id}
    <div class="frame" class:moving={dx !== 0} style:transform={dx ? `translateX(${dx * 0.6}px)` : undefined}>
      <PhotoImg id={photos[index]!.id} variant="full" alt={t('ledger.photo', { n: index + 1, total: photos.length })} class="full" />
    </div>
  {/key}
  <div class="bar">
    <span>{index + 1} / {photos.length}</span>
    <button type="button" class="btn btn-secondary" onclick={onclose}>{t('action.close')}</button>
  </div>
</div>

<style>
  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: var(--scanner-bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left);
    touch-action: pan-y;
  }
  .frame {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    max-height: calc(100% - 4rem);
    animation: fade-in var(--dur-settle) var(--ease-settle);
    transition: transform var(--dur-settle) var(--ease-settle);
  }
  .frame.moving {
    transition: none;
  }
  .lightbox :global(.full) {
    max-width: 100%;
    max-height: calc(100dvh - 4rem - var(--inset-top) - var(--inset-bottom));
    object-fit: contain;
  }
  .bar {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-top: 1rem;
    color: var(--scanner-fg);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
  /* Over a photo, the button keeps the viewer's colours in both themes. */
  .bar .btn {
    color: var(--scanner-fg);
    border-color: var(--scanner-fg);
  }
  .bar .btn:hover {
    background: var(--scanner-fg);
    color: var(--scanner-bg);
  }
</style>
