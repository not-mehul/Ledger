<script lang="ts">
  import { inYear, rank, type RankKey } from '../../domain/insights';
  import { RATING_MAX, activeCategories, activeMetrics } from '../../domain/metrics';
  import { scoreTier } from '../../domain/score';
  import { categoryName, metricName, t } from '../../i18n/index.svelte';
  import { ledger } from '../../state/ledger.svelte';
  import { ui } from '../../state/ui.svelte';

  interface Props {
    year: number | null;
  }

  let { year }: Props = $props();

  const TOP = 10;
  /** "score", "category:<id>" or "metric:<id>" — a plain string so it can drive a <select>. */
  let by = $state('score');
  let showAll = $state(false);

  const key = $derived.by((): RankKey => {
    const [kind, id] = by.split(':') as ['score' | 'category' | 'metric', string | undefined];
    return kind === 'score' || !id ? { kind: 'score' } : { kind, id };
  });
  // Fall back to the overall score if the chosen category or metric is hidden or deleted.
  $effect(() => {
    if (key.kind === 'category' && !activeCategories(ledger.config).some((c) => c.id === key.id)) by = 'score';
    if (key.kind === 'metric' && !activeMetrics(ledger.config).some((m) => m.id === key.id)) by = 'score';
  });

  const ranked = $derived(rank(inYear(ledger.entries, year), ledger.config, key));
  const shown = $derived(showAll ? ranked : ranked.slice(0, TOP));
  const max = $derived(key.kind === 'score' ? 100 : RATING_MAX);

  function format(value: number): string {
    // Single metrics are whole ratings; scores and category averages have decimals.
    return key.kind === 'metric' ? String(value) : value.toFixed(1);
  }
</script>

<section class="panel" id="rankings" aria-labelledby="rankHeading">
  <div class="section-head">
    <h2 id="rankHeading">{t('rank.title')}</h2>
  </div>

  <label class="rank-by">
    <span class="field-label">{t('rank.by')}</span>
    <select class="field-input" id="rankBy" bind:value={by} onchange={() => (showAll = false)}>
      <option value="score">{t('rank.overall')}</option>
      <optgroup label={t('rank.categories')}>
        {#each activeCategories(ledger.config) as c (c.id)}
          <option value="category:{c.id}">{c.icon ? `${c.icon} ` : ''}{categoryName(c)}</option>
        {/each}
      </optgroup>
      <optgroup label={t('rank.metrics')}>
        {#each activeMetrics(ledger.config) as m (m.id)}
          <option value="metric:{m.id}">{metricName(m)}</option>
        {/each}
      </optgroup>
    </select>
  </label>

  {#if !ranked.length}
    <p class="settings-hint">{t('rank.empty')}</p>
  {:else}
    <ol class="ranking" id="rankingList">
      {#each shown as r, i (r.entry.id)}
        <li>
          <button type="button" onclick={() => ui.showInLedger(r.entry.id)}>
            <span class="pos">{i + 1}</span>
            <span class="who">
              <span class="city">{r.entry.city}</span>
              <span class="region">{r.entry.state}</span>
            </span>
            <span class="bar" aria-hidden="true">
              <span style:width="{(r.value / max) * 100}%" style:background="var({scoreTier((r.value / max) * 100).cssVar})"></span>
            </span>
            <span class="val">{format(r.value)}</span>
          </button>
        </li>
      {/each}
    </ol>
    {#if ranked.length > TOP}
      <button type="button" class="btn btn-ghost" onclick={() => (showAll = !showAll)}>
        {showAll ? t('rank.showLess') : t('rank.showAll', { count: ranked.length })}
      </button>
    {/if}
  {/if}
</section>

<style>
  .rank-by {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }
  .ranking {
    list-style: none;
    margin-bottom: 1rem;
  }
  .ranking button {
    display: grid;
    grid-template-columns: 1.75rem minmax(0, 1fr) minmax(3rem, 30%) 3rem;
    gap: 0.75rem;
    align-items: center;
    width: 100%;
    padding: 0.625rem 0;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border-soft);
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .pos {
    font-family: var(--font-mono);
    color: var(--accent-amber);
    font-size: 0.875rem;
  }
  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .city {
    font-family: var(--font-serif);
    color: var(--text-heading);
    font-size: 1.0625rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .region {
    font-size: 0.625rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .bar {
    height: 3px;
    background: var(--chart-track);
    border-radius: 2px;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
  }
  .val {
    font-family: var(--font-mono);
    color: var(--text-muted);
    font-size: 0.8125rem;
    text-align: right;
  }
</style>
