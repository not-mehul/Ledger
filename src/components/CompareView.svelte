<script lang="ts">
  // Two or three cities side by side: overall score, each category's average
  // and every metric, with the leader of each row in amber.
  import { compare } from '../domain/compare';
  import type { Entry } from '../domain/entry';
  import { RATING_MAX, type MetricConfig } from '../domain/metrics';
  import { categoryName, locale, metricName, t } from '../i18n/index.svelte';
  import { formatMonth } from '../lib/dates';
  import ScoreDial from './ScoreDial.svelte';

  interface Props {
    entries: Entry[];
    config: MetricConfig;
    onopen: (id: string) => void;
  }

  let { entries, config, onopen }: Props = $props();

  const result = $derived(compare(entries, config));
  const cols = $derived(entries.length);

  const verdict = $derived.by(() => {
    const ranked = result.scores
      .map((s, i) => ({ s, i }))
      .filter((x): x is { s: number; i: number } => x.s !== null)
      .sort((a, b) => b.s - a.s);
    if (ranked.length < 2) return null;
    const gap = Math.round((ranked[0]!.s - ranked[1]!.s) * 10) / 10;
    return gap === 0 ? t('compare.even') : t('compare.ahead', { city: entries[ranked[0]!.i]!.city, points: gap.toFixed(1) });
  });

  const fmt = (v: number | null, decimals = 0) => (v === null ? '—' : v.toFixed(decimals));
</script>

<div class="compare" style:--cols={cols} id="compareView">
  <div class="cmp-heads">
    {#each entries as e, i (e.id)}
      <button type="button" class="cmp-head" class:lead={result.scoreLeaders.includes(i)} onclick={() => onopen(e.id)}>
        <ScoreDial score={result.scores[i] ?? null} size={56} stroke={7} labelled />
        <span class="cmp-city">{e.city}</span>
        <span class="cmp-when">{formatMonth(e.date, locale())}</span>
        <span class="cmp-wins">{t('compare.leads', { count: result.wins[i] ?? 0 })}</span>
      </button>
    {/each}
  </div>

  {#if verdict}
    <p class="cmp-verdict" id="compareVerdict">{verdict}</p>
  {/if}

  {#each result.groups as g (g.category.id)}
    <section class="cmp-group" aria-label={categoryName(g.category)}>
      <div class="cmp-cat">
        <span class="cmp-cat-name">{g.category.icon ? `${g.category.icon} ` : ''}{categoryName(g.category)}</span>
        <span class="cmp-cells">
          {#each g.averages as v, i (i)}
            <span class="cmp-cell cmp-avg" class:lead={g.leaders.includes(i)}>{fmt(v, 1)}</span>
          {/each}
        </span>
      </div>
      {#each g.rows as r (r.metric.id)}
        <div class="cmp-row" data-metric={r.metric.id}>
          <span class="cmp-metric">{metricName(r.metric)}</span>
          <span class="cmp-cells">
            {#each r.values as v, i (i)}
              <span class="cmp-cell" class:lead={r.leaders.includes(i)}>
                <span class="cmp-bar" aria-hidden="true"><span class="grow-x" style:width="{v === null ? 0 : (v / RATING_MAX) * 100}%"></span></span>
                <span class="cmp-num" aria-label="{entries[i]!.city}: {v === null ? t('compare.notRated') : v}">{fmt(v)}</span>
              </span>
            {/each}
          </span>
        </div>
      {/each}
    </section>
  {/each}
</div>

<style>
  .compare {
    --cols: 2;
  }
  .cmp-heads {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: 1px;
    background: var(--border-faint);
    border: 1px solid var(--border-faint);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 1rem;
  }
  .cmp-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.875rem 0.5rem;
    background: var(--panel-bg-faint);
    border: none;
    color: inherit;
    cursor: pointer;
    min-width: 0;
    transition: background-color var(--dur-hover);
  }
  .cmp-head:hover {
    background: var(--hover-bg);
  }
  .cmp-city {
    font-family: var(--font-serif);
    font-size: 1.125rem;
    color: var(--text-heading);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cmp-head.lead .cmp-city {
    font-style: italic;
    color: var(--accent-amber);
  }
  .cmp-when,
  .cmp-wins {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-dim);
    text-align: center;
  }
  .cmp-verdict {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 1rem;
    line-height: 1.5;
    color: var(--text-body);
    margin-bottom: 1.25rem;
  }
  .cmp-group {
    margin-bottom: 1.25rem;
  }
  .cmp-cat,
  .cmp-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.25rem;
  }
  .cmp-cat {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-soft);
  }
  .cmp-cat-name {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .cmp-row {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-faint);
  }
  .cmp-metric {
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  .cmp-cells {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: 0.75rem;
  }
  .cmp-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    min-width: 0;
  }
  .cmp-avg {
    font-family: var(--font-serif);
    font-size: 1.125rem;
    color: var(--text-heading);
  }
  .cmp-cell.lead {
    color: var(--accent-amber);
  }
  .cmp-bar {
    flex: 1;
    height: 4px;
    background: var(--chart-track);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .cmp-bar span {
    display: block;
    height: 100%;
    background: var(--accent-sage);
  }
  .cmp-cell.lead .cmp-bar span {
    background: var(--accent-amber);
  }
  .cmp-num {
    min-width: 2ch;
    text-align: right;
  }
  @media (min-width: 640px) {
    .cmp-cat,
    .cmp-row {
      grid-template-columns: minmax(10rem, 1fr) minmax(0, 2fr);
      align-items: center;
      gap: 1rem;
    }
    .cmp-heads {
      margin-left: calc((100% - 1rem) / 3 + 1rem);
    }
  }
</style>
