<script lang="ts">
  import { yearsOf } from '../../domain/insights';
  import { t } from '../../i18n/index.svelte';
  import { ledger } from '../../state/ledger.svelte';
  import { ui } from '../../state/ui.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Patterns from './Patterns.svelte';
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

  /** The card's period button steps newest year → older years → all time → newest again. */
  const next = $derived.by(() => {
    const order: (number | null)[] = [...years, null];
    return order[(order.indexOf(year) + 1) % order.length] ?? null;
  });
</script>

<div id="viewInsights" role="tabpanel" aria-labelledby="tabInsights">
  {#if !ledger.entries.length}
    <EmptyState icon="chart" title={t('insights.emptyTitle')} text={t('insights.empty')} action={t('ledger.addFirst')} onaction={() => ui.go('entry')} />
  {:else}
    <YearReview {year} {next} onperiod={() => (year = next)} />
    <Patterns {year} />
    <Rankings {year} />
    <ValueSignals />
  {/if}
</div>
