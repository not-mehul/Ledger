<script lang="ts">
  import { yearsOf } from '../../domain/insights';
  import { t } from '../../i18n/index.svelte';
  import { ledger } from '../../state/ledger.svelte';
  import { ui } from '../../state/ui.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
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
    <EmptyState icon="chart" title={t('insights.emptyTitle')} text={t('insights.empty')} action={t('ledger.addFirst')} onaction={() => ui.go('entry')} />
  {:else}
    <div class="chip-row period" role="radiogroup" aria-label={t('insights.period')}>
      {#each years as y (y)}
        <button type="button" role="radio" class="chip" aria-checked={year === y} data-year={y} onclick={() => (year = y)}>
          {y}
        </button>
      {/each}
      <button type="button" role="radio" class="chip" aria-checked={year === null} data-year="all" onclick={() => (year = null)}>
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
    margin-bottom: 1.25rem;
  }
</style>
