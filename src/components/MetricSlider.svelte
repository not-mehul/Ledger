<script lang="ts">
  import { HEAVY_WEIGHT, RATING_MAX, RATING_MIN, type Metric } from '../domain/metrics';
  import { ratingLevel } from '../domain/score';
  import { metricEnds, metricName, t } from '../i18n/index.svelte';

  interface Props {
    metric: Metric;
    value: number;
    /** False for a metric this entry doesn't rate (skipped, or added since): "Not rated" until moved. */
    rated?: boolean;
    /** Takes the rating off, so the metric doesn't count. Shown while rated. */
    onskip?: () => void;
  }

  let { metric, value = $bindable(), rated = true, onskip }: Props = $props();

  const level = $derived(ratingLevel(value));
  const pct = $derived(rated ? (((value - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100).toFixed(2) : '0');
  const ends = $derived(metricEnds(metric));
  const id = $derived(`sl-${metric.id}`);
</script>

<div class="metric-item">
  <div class="metric-header">
    <span class="metric-name-row">
      <label class="t-field-label metric-name" for={id}>{metricName(metric)}</label>
      <!-- The weight, only when it isn't the usual ×1. -->
      {#if metric.weight !== 1}<span class="badge slider-weight" class:is-high={metric.weight >= HEAVY_WEIGHT} aria-hidden="true">×{metric.weight}</span>{/if}
    </span>
    <span class="metric-end">
      <span class="metric-val" class:low-val={rated && level === 'low'} class:high-val={rated && level === 'high'} id="disp-{metric.id}"
        >{#if rated}{value}<span class="denom">/{RATING_MAX}</span>{:else}<span class="denom">{t('form.notRated')}</span>{/if}</span
      >
      {#if rated && onskip}
        <button type="button" class="skip" data-skip={metric.id} aria-label={t('form.skipMetric', { metric: metricName(metric) })} onclick={onskip}>{t('form.skip')}</button>
      {/if}
    </span>
  </div>
  <div class="slider-wrap" class:unrated={!rated}>
    <input
      type="range"
      class="metric-slider"
      {id}
      min={RATING_MIN}
      max={RATING_MAX}
      step="1"
      bind:value
      aria-valuetext={rated ? undefined : t('form.notRated')}
      style:background="linear-gradient(to right, var(--accent-amber) {pct}%, var(--chart-track) {pct}%)"
    />
  </div>
  <div class="slider-footer" aria-hidden="true">
    <div class="slider-ends">
      <span>{ends[0]}</span>
      <span>{ends[1]}</span>
    </div>
  </div>
</div>

<style>
  .metric-end {
    display: inline-flex;
    align-items: baseline;
    gap: 0.75rem;
  }
  /* A quiet word with a full-size touch target around it. */
  .skip {
    position: relative;
    padding: 0;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-dim);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .skip::before {
    content: '';
    position: absolute;
    inset: -14px -10px;
  }
  .skip:hover,
  .skip:focus-visible {
    color: var(--accent-amber);
  }
  .unrated {
    opacity: 0.55;
  }
</style>
