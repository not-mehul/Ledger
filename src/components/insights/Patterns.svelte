<script lang="ts">
  // Score over time (each visit as a dot, with the running average), how
  // scores spread across the tiers, and which metrics you rate most
  // generously and most harshly.
  import { MIN_HABIT_ENTRIES, inYear, ratingHabits, scoreTimeline, tierSpread } from '../../domain/insights';
  import { scoreTier } from '../../domain/score';
  import { locale, metricName, t } from '../../i18n/index.svelte';
  import { formatMonth } from '../../lib/dates';
  import { ledger } from '../../state/ledger.svelte';
  import { ui } from '../../state/ui.svelte';

  interface Props {
    year: number | null;
  }

  let { year }: Props = $props();

  const entries = $derived(inYear(ledger.entries, year));
  const points = $derived(scoreTimeline(entries, ledger.config));
  const spread = $derived(tierSpread(entries, ledger.config));
  const rated = $derived(spread.reduce((n, s) => n + s.count, 0));
  const habits = $derived(ratingHabits(entries, ledger.config));

  // Chart geometry, in viewBox units. Dots are spaced evenly in visit order.
  const W = 320;
  const H = 150;
  const PAD = { top: 10, right: 12, bottom: 22, left: 26 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const GRID = [25, 50, 75, 100];

  const x = (i: number) => PAD.left + (points.length < 2 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (score: number) => PAD.top + (1 - score / 100) * plotH;
  const runningPath = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.running).toFixed(1)}`).join(''));

  const trend = $derived.by(() => {
    if (points.length < 3) return null;
    const change = Math.round((points[points.length - 1]!.running - points[0]!.score) * 10) / 10;
    if (Math.abs(change) < 1) return t('patterns.steady');
    return t(change > 0 ? 'patterns.rising' : 'patterns.falling', { points: Math.abs(change).toFixed(1) });
  });

  function open(id: string) {
    ui.showInLedger(id);
  }
</script>

<section class="panel" id="patterns" aria-labelledby="patternsHeading">
  <div class="section-head">
    <h2 id="patternsHeading">{t('patterns.title')}</h2>
  </div>

  {#if points.length}
    <div class="mini-cat-label">{t('patterns.timeline')}</div>
    <svg class="timeline" viewBox="0 0 {W} {H}" role="group" aria-label={t('patterns.timeline')}>
      {#each GRID as g (g)}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} class="grid" />
        <text x={PAD.left - 6} y={y(g) + 3} text-anchor="end" class="axis">{g}</text>
      {/each}
      {#if points.length > 1}
        <path d={runningPath} class="running" />
      {/if}
      {#each points as p, i (p.entry.id)}
        {@const label = t('patterns.point', { city: p.entry.city, month: formatMonth(p.entry.date, locale()), score: p.score.toFixed(1) })}
        <g
          class="dot"
          role="button"
          tabindex="0"
          aria-label={label}
          onclick={() => open(p.entry.id)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              open(p.entry.id);
            }
          }}
        >
          <title>{label}</title>
          <circle cx={x(i)} cy={y(p.score)} r="11" class="hit" />
          <circle cx={x(i)} cy={y(p.score)} r="4" style:fill="var({scoreTier(p.score).cssVar})" class="mark" />
        </g>
      {/each}
      <text x={PAD.left} y={H - 6} class="axis">{formatMonth(points[0]!.entry.date, locale())}</text>
      {#if points.length > 1}
        <text x={W - PAD.right} y={H - 6} text-anchor="end" class="axis">{formatMonth(points[points.length - 1]!.entry.date, locale())}</text>
      {/if}
    </svg>
    <p class="t-hint">{trend ?? t('patterns.timelineHint')}</p>
  {/if}

  {#if rated}
    <div class="mini-cat-label">{t('patterns.spread')}</div>
    <div class="spread-bar grow-x" aria-hidden="true">
      {#each spread as s (s.id)}
        {#if s.count}
          <span style:flex-grow={s.count} style:background="var(--scale-{spread.indexOf(s) + 1})"></span>
        {/if}
      {/each}
    </div>
    <ul class="spread-legend" id="tierSpread">
      {#each spread as s, i (s.id)}
        <li data-tier={s.id} class:empty={!s.count}>
          <span class="swatch" style:background="var(--scale-{i + 1})" aria-hidden="true"></span>
          <span class="tier-name">{t(`tierName.${s.id}`)}</span>
          <span class="tier-count tabular">{s.count}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="mini-cat-label">{t('patterns.habits')}</div>
  {#if habits}
    <dl class="habits hairline-grid" id="ratingHabits">
      {#each [{ key: 'generous', h: habits.generous }, { key: 'harsh', h: habits.harsh }] as item (item.key)}
        <div class="habit" data-habit={item.key}>
          <dt class="t-field-label">{item.key === 'generous' ? t('patterns.generous') : t('patterns.harsh')}</dt>
          <dd class="habit-metric">{metricName(item.h.metric)}</dd>
          <dd class="habit-avg">{t('patterns.average', { value: item.h.average.toFixed(1) })}</dd>
        </div>
      {/each}
    </dl>
  {:else}
    <p class="t-hint">{t('patterns.needMore', { min: MIN_HABIT_ENTRIES })}</p>
  {/if}
</section>

<style>
  .timeline {
    display: block;
    width: 100%;
    height: auto;
    margin-bottom: 0.5rem;
    overflow: visible;
  }
  .grid {
    stroke: var(--chart-grid);
    stroke-width: 1;
  }
  .axis {
    font-family: var(--font-mono);
    font-size: 8px;
    fill: var(--text-dim);
  }
  .running {
    fill: none;
    stroke: var(--series-1);
    stroke-width: 1.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .dot {
    cursor: pointer;
    outline: none;
  }
  .hit {
    fill: transparent;
  }
  .mark {
    stroke: var(--bg-grad-mid);
    stroke-width: 1.5;
    transition: r var(--dur-hover);
  }
  .dot:hover .mark,
  .dot:focus-visible .mark {
    r: 6;
  }
  .dot:focus-visible .hit {
    stroke: var(--focus-ring);
    stroke-width: 1.5;
  }
  .t-hint {
    margin-bottom: 1.25rem;
  }

  .spread-bar {
    display: flex;
    gap: 2px;
    height: 8px;
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 0.75rem;
  }
  .spread-bar span {
    flex-basis: 0;
  }
  .spread-legend {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
    gap: 0.375rem 1rem;
    margin-bottom: 1.25rem;
  }
  .spread-legend li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text-muted);
  }
  .spread-legend li.empty {
    color: var(--text-dim);
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: var(--radius);
    flex-shrink: 0;
  }
  .spread-legend li.empty .swatch {
    opacity: 0.35;
  }
  .tier-count {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  .habits {
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  }
  .habit {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.875rem 1rem;
    background: var(--panel-bg-faint);
  }
  .habit-metric {
    font-family: var(--font-serif);
    font-size: 1.125rem;
    line-height: 1.25;
    color: var(--text-heading);
  }
  .habit[data-habit='generous'] .habit-metric {
    font-style: italic;
    color: var(--accent-amber);
  }
  .habit-avg {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
</style>
