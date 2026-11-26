<script lang="ts">
  // A city across all its visits (feature review, N5): how often, how it
  // scores on average and how that moved, each category over the visits, and
  // every visit with its notes.
  import { scoreChange, visitsTo } from '../domain/context';
  import type { Entry } from '../domain/entry';
  import { categoryAverage } from '../domain/insights';
  import { RATING_MAX, activeCategories } from '../domain/metrics';
  import { categoryName, locale, t } from '../i18n/index.svelte';
  import { formatMonth } from '../lib/dates';
  import { ledger } from '../state/ledger.svelte';
  import CategoryIcon from './ui/CategoryIcon.svelte';
  import ScoreDial from './ScoreDial.svelte';

  interface Props {
    place: Pick<Entry, 'city' | 'state'>;
    /** Opens one visit in the ledger. */
    onvisit: (id: string) => void;
  }

  let { place, onvisit }: Props = $props();

  const visits = $derived(visitsTo(ledger.entries, place));
  const scores = $derived(visits.map((v) => ledger.scoreOf(v)).filter((s): s is number => s !== null));
  const average = $derived(scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null);
  const change = $derived(visits.length > 1 ? scoreChange(visits[0]!, visits.at(-1)!, ledger.config) : null);
  const categories = $derived(
    activeCategories(ledger.config)
      .map((cat) => {
        const values = visits.map((v) => categoryAverage(v, ledger.config, cat.id)).filter((v): v is number => v !== null);
        return { cat, value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
      })
      .filter((c): c is { cat: (typeof c)['cat']; value: number } => c.value !== null),
  );
  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(1)}`;
</script>

<div class="city-view" data-testid="city-view">
  <dl class="tiles hairline-grid">
    <div class="tile">
      <dt class="t-field-label">{t('city.visits')}</dt>
      <dd class="tile-value tabular">{visits.length}</dd>
    </div>
    <div class="tile">
      <dt class="t-field-label">{t('city.average')}</dt>
      <dd class="tile-value tabular">{average === null ? '—' : average.toFixed(1)}</dd>
    </div>
    {#if change !== null}
      <div class="tile">
        <dt class="t-field-label">{t('city.since', { month: formatMonth(visits[0]!.date, locale()) })}</dt>
        <dd class="tile-value tabular" class:up={change > 0} class:down={change < 0}>{signed(change)}</dd>
      </div>
    {/if}
  </dl>

  {#if categories.length}
    <h3 class="t-section-label">{t('city.overVisits')}</h3>
    {#each categories as { cat, value } (cat.id)}
      <div class="mini-row">
        <span class="mini-name"><CategoryIcon category={cat} size={14} /> {categoryName(cat)}</span>
        <div class="mini-bar-bg"><div class="mini-bar-fill" style:width="{(value / RATING_MAX) * 100}%" style:background="var(--accent-sage)"></div></div>
        <span class="mini-val">{value.toFixed(1)}</span>
      </div>
    {/each}
  {/if}

  <h3 class="t-section-label">{t('city.everyVisit')}</h3>
  <div class="settings-group">
    {#each [...visits].reverse() as v (v.id)}
      <button type="button" class="settings-row visit" onclick={() => onvisit(v.id)}>
        <ScoreDial score={ledger.scoreOf(v)} size={44} stroke={4} labelled />
        <span class="settings-row-text">
          <span class="settings-row-title">{formatMonth(v.date, locale())}</span>
          {#if v.notes}<span class="settings-row-hint notes">{v.notes}</span>{/if}
        </span>
      </button>
    {/each}
  </div>
</div>

<style>
  .city-view {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .tiles {
    display: flex;
    flex-wrap: wrap;
  }
  .tile {
    flex: 1 1 6.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.75rem 0.875rem;
  }
  .tile-value {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    color: var(--text-heading);
  }
  .tile-value.up {
    color: var(--accent-sage);
  }
  .tile-value.down {
    color: var(--accent-amber);
  }
  .t-section-label {
    margin: 0.5rem 0 0;
  }
  .notes {
    white-space: pre-line;
  }
</style>
