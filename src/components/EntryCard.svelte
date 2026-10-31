<script lang="ts">
  import type { Entry } from '../domain/entry';
  import { HEAVY_WEIGHT, RATING_MAX, activeCategories, metricsIn } from '../domain/metrics';
  import { categoryName, locale, metricName, t } from '../i18n/index.svelte';
  import { formatMonth } from '../lib/dates';
  import { ledger } from '../state/ledger.svelte';
  import PhotoImg from './PhotoImg.svelte';
  import ScoreDial from './ScoreDial.svelte';

  interface Props {
    entry: Entry;
    open: boolean;
    ontoggle: () => void;
    onedit: () => void;
    ondelete: () => void;
    onshare: () => void;
    onphoto: (index: number) => void;
  }

  let { entry, open, ontoggle, onedit, ondelete, onshare, onphoto }: Props = $props();

  const score = $derived(ledger.scoreOf(entry));
  const categories = $derived(
    activeCategories(ledger.config)
      .map((cat) => ({ cat, metrics: metricsIn(ledger.config, cat.id).filter((m) => typeof entry.ratings[m.id] === 'number') }))
      .filter((g) => g.metrics.length),
  );
</script>

<article class="entry-card" class:open id="card-{entry.id}">
  <button
    type="button"
    class="entry-card-header"
    aria-expanded={open}
    aria-controls="detail-{entry.id}"
    onclick={ontoggle}
  >
    <ScoreDial
      {score}
      size={64}
      stroke={6}
      labelled
      label={score === null ? t('ledger.unrated') : t('ledger.scoreLabel', { score })}
    />
    <span class="entry-city-block">
      <span class="entry-city-name">{entry.city}<span class="entry-region">, {entry.state}</span></span>
      <span class="entry-meta">{formatMonth(entry.date, locale())}{entry.photos.length ? ` · ◫ ${entry.photos.length}` : ''}</span>
    </span>
    <svg class="entry-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </button>

  {#if open}
    <div class="entry-detail" id="detail-{entry.id}">
      {#if entry.photos.length}
        <div class="gallery">
          {#each entry.photos as photo, i (photo.id)}
            <button type="button" class="gallery-item" class:cover={i === 0} onclick={() => onphoto(i)}>
              <PhotoImg id={photo.id} variant={i === 0 ? 'full' : 'thumb'} alt={t('ledger.photo', { n: i + 1, total: entry.photos.length })} />
            </button>
          {/each}
        </div>
      {/if}

      {#each categories as { cat, metrics } (cat.id)}
        <div class="mini-cat-label">{cat.icon ? `${cat.icon} ` : ''}{categoryName(cat)}</div>
        {#each metrics as m (m.id)}
          {@const val = entry.ratings[m.id] ?? 0}
          <div class="mini-row">
            <span class="mini-name">{metricName(m)}</span>
            <div class="mini-bar-bg">
              <div
                class="mini-bar-fill"
                style:width="{(val / RATING_MAX) * 100}%"
                style:background={m.weight >= HEAVY_WEIGHT ? 'var(--accent-amber)' : 'var(--accent-sage)'}
              ></div>
            </div>
            <span class="mini-val">{val}/{RATING_MAX}</span>
          </div>
        {/each}
      {/each}

      {#if entry.notes}
        <div class="entry-notes-block">
          <div class="entry-notes-label">{t('ledger.notes')}</div>
          <div class="entry-notes-text">{entry.notes}</div>
        </div>
      {/if}

      <div class="entry-card-actions">
        <button type="button" class="btn btn-ghost" data-action="edit" onclick={onedit}>{t('action.edit')}</button>
        <button type="button" class="btn btn-ghost" data-action="share" onclick={onshare}>{t('action.share')}</button>
        <button type="button" class="btn btn-danger" data-action="delete" onclick={ondelete}>{t('action.delete')}</button>
      </div>
    </div>
  {/if}
</article>

<style>
  .entry-detail {
    display: block;
  }
  .entry-notes-text {
    white-space: pre-line;
  }
  .gallery {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    margin-bottom: 1.25rem;
  }
  .gallery-item {
    padding: 0;
    border: none;
    background: none;
    cursor: zoom-in;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: var(--radius);
  }
  .gallery-item.cover {
    grid-column: 1 / -1;
    aspect-ratio: 16 / 9;
  }
  .gallery-item :global(img),
  .gallery-item :global(.photo-placeholder) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .entry-card-actions {
    flex-wrap: wrap;
  }
</style>
