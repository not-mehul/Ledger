<script lang="ts">
  import { deletePhoto, savePhoto } from '../data/photo-store';
  import type { Photo } from '../domain/entry';
  import { t } from '../i18n/index.svelte';
  import { processPhoto } from '../platform/images';
  import { ui } from '../state/ui.svelte';
  import PhotoImg from './PhotoImg.svelte';

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
      <button type="button" class="remove" aria-label={t('form.removePhoto')} onclick={() => removeAt(i)}>×</button>
    </figure>
  {/each}
  {#if busy}
    <div class="pending" aria-live="polite">{t('form.processingPhotos')}</div>
  {/if}
</div>

<div class="photo-actions">
  <label class="btn btn-ghost">
    {t('form.addPhotos')}
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
  <label class="btn btn-ghost">
    {t('form.takePhoto')}
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
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
  }
  .pending {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    font-size: 0.625rem;
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
