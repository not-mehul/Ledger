<script lang="ts">
  import { yearsOf } from '../../domain/insights';
  import { t } from '../../i18n/index.svelte';
  import { ledger } from '../../state/ledger.svelte';
  import Rankings from './Rankings.svelte';
  import ValueSignals from './ValueSignals.svelte';
  import YearReview from './YearReview.svelte';

  const years = $derived(yearsOf(ledger.entries));
  /** null = all time. Defaults to the most recent year with entries. */
  let year = $state<number | null>(yearsOf(ledger.entries)[0] ?? null);

  // If the chosen year no longer has entries (deleted or edited), show all time.
  $effect(() => {
    if (year !== null && !years.includes(year)) year = null;
  });
</script>

<div id="viewInsights" role="tabpanel" aria-labelledby="tabInsights">
  {#if !ledger.entries.length}
    <div class="empty-state">
      <p class="empty-title">{t('insights.empty')}</p>
    </div>
  {:else}
    <div class="sort-row period" role="radiogroup" aria-label={t('insights.period')}>
      {#each years as y (y)}
        <button type="button" role="radio" class="sort-btn" class:active={year === y} aria-checked={year === y} data-year={y} onclick={() => (year = y)}>
          {y}
        </button>
      {/each}
      <button type="button" role="radio" class="sort-btn" class:active={year === null} aria-checked={year === null} data-year="all" onclick={() => (year = null)}>
        {t('insights.allTime')}
      </button>
    </div>

    <YearReview {year} />
    <Rankings {year} />
    <ValueSignals />
  {/if}
</div>

<style>
  .period {
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }
</style>
