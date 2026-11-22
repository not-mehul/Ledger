<script lang="ts">
  import { HEAVY_WEIGHT, RATING_MAX, RATING_MIN, type Metric } from '../domain/metrics';
  import { ratingLevel } from '../domain/score';
  import { metricEnds, metricName, t } from '../i18n/index.svelte';

  interface Props {
    metric: Metric;
    value: number;
    /** False for a metric the entry being edited never rated: shown as "—" until moved. */
    rated?: boolean;
  }

  let { metric, value = $bindable(), rated = true }: Props = $props();

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
    <span class="metric-val" class:low-val={rated && level === 'low'} class:high-val={rated && level === 'high'} id="disp-{metric.id}"
      >{#if rated}{value}<span class="denom">/{RATING_MAX}</span>{:else}<span class="denom">{t('form.notRated')}</span>{/if}</span
    >
  </div>
  <div class="slider-wrap">
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
