<script lang="ts">
  import { deletePhoto, savePhoto } from '../data/photo-store';
  import type { Photo } from '../domain/entry';
  import { t } from '../i18n/index.svelte';
  import { processPhoto } from '../platform/images';
  import { ui } from '../state/ui.svelte';
  import PhotoImg from './PhotoImg.svelte';
  import Icon from './ui/Icon.svelte';

  interface Props {
    photos: Photo[];
    /** Photos belonging to the saved entry; never deleted from here. */
    saved: ReadonlySet<string>;
  }

  let { photos = $bindable(), saved }: Props = $props();
  let busy = $state(false);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    busy = true;
    try {
      for (const file of files) {
        try {
          const { full, thumb } = await processPhoto(file);
          const id = crypto.randomUUID();
          await savePhoto(id, full.bytes, thumb.bytes);
          photos = [...photos, { id, width: full.width, height: full.height }];
        } catch (err) {
          console.warn('Photo failed:', err);
          ui.notify(t('toast.photoFailed'), 'error');
        }
      }
    } finally {
      busy = false;
    }
  }

  function removeAt(index: number) {
    const removed = photos[index];
    photos = photos.filter((_, j) => j !== index);
    // Unsaved photos can go now; saved ones are removed when the entry is saved.
    if (removed && !saved.has(removed.id)) void deletePhoto(removed.id);
  }
</script>

<div class="photo-strip">
  {#each photos as photo, i (photo.id)}
    <figure>
      <PhotoImg id={photo.id} alt={t('ledger.photo', { n: i + 1, total: photos.length })} class="thumb" />
      <button type="button" class="remove" aria-label={t('form.removePhoto')} onclick={() => removeAt(i)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button>
    </figure>
  {/each}
  {#if busy}
    <div class="pending" aria-live="polite">{t('form.processingPhotos')}</div>
  {/if}
</div>

<div class="photo-actions">
  <label class="photo-btn" title={t('form.addPhotos')}>
    <Icon name="imagePlus" size={20} />
    <span class="visually-hidden">{t('form.addPhotos')}</span>
    <input
      type="file"
      accept="image/*"
      multiple
      class="visually-hidden"
      id="photoInput"
      onchange={(e) => {
        const input = e.currentTarget;
        void add(input.files).then(() => (input.value = ''));
      }}
    />
  </label>
  <label class="photo-btn" title={t('form.takePhoto')}>
    <Icon name="camera" size={20} />
    <span class="visually-hidden">{t('form.takePhoto')}</span>
    <input
      type="file"
      accept="image/*"
      capture="environment"
      class="visually-hidden"
      onchange={(e) => {
        const input = e.currentTarget;
        void add(input.files).then(() => (input.value = ''));
      }}
    />
  </label>
</div>

<style>
  /* The same bordered square as the map's zoom buttons. */
  .photo-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-dim);
    cursor: pointer;
    transition: color var(--dur-hover), border-color var(--dur-hover);
  }
  .photo-btn:hover {
    color: var(--text-heading);
    border-color: var(--text-dim);
  }
  .photo-btn:focus-within {
    outline: 2px solid var(--accent-amber);
    outline-offset: 2px;
  }
  .photo-strip {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 0.5rem;
  }
  .photo-strip:not(:empty) {
    margin-bottom: 0.875rem;
  }
  figure {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: var(--radius);
    border: 1px solid var(--border-soft);
  }
  figure :global(.thumb) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 28px;
    height: 28px;
    border-radius: var(--radius);
    border: none;
    background: var(--scanner-scrim);
    color: var(--scanner-fg);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .pending {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    font-size: 0.75rem;
    color: var(--text-dim);
    border: 1px dashed var(--border);
    text-align: center;
    padding: 0.25rem;
  }
  .photo-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .photo-actions label {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
</style>
