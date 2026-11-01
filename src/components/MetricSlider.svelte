<script lang="ts">
  import { HEAVY_WEIGHT, RATING_MAX, RATING_MIN, type Metric } from '../domain/metrics';
  import { ratingLevel } from '../domain/score';
  import { metricEnds, metricName } from '../i18n/index.svelte';

  interface Props {
    metric: Metric;
    value: number;
  }

  let { metric, value = $bindable() }: Props = $props();

  const level = $derived(ratingLevel(value));
  const pct = $derived((((value - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100).toFixed(2));
  const ends = $derived(metricEnds(metric));
  const id = $derived(`sl-${metric.id}`);
</script>

<div class="metric-item">
  <div class="metric-header">
    <label class="t-field-label metric-name" for={id}>{metricName(metric)}</label>
    <span class="metric-val" class:low-val={level === 'low'} class:high-val={level === 'high'} id="disp-{metric.id}"
      >{value}<span class="denom">/{RATING_MAX}</span></span
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
      style:background="linear-gradient(to right, var(--accent-amber) {pct}%, var(--chart-track) {pct}%)"
    />
  </div>
  <div class="slider-footer" aria-hidden="true">
    <div class="slider-ends">
      <span>{ends[0]}</span>
      <span>{ends[1]}</span>
    </div>
    <span class="slider-weight" class:is-high={metric.weight >= HEAVY_WEIGHT}>×{metric.weight}</span>
  </div>
</div>
