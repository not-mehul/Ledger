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

  const SECTIONS = [
    { id: 'yearReview', key: 'insights.jumpReview' },
    { id: 'patterns', key: 'patterns.title' },
    { id: 'rankings', key: 'rank.title' },
    { id: 'valueSignals', key: 'insights.jumpValues' },
  ] as const;

  /** Scrolls a section to just under the sticky tabs, and moves focus to its heading. */
  function jump(id: string) {
    const section = document.getElementById(id);
    if (!section) return;
    const tabs = document.querySelector('.tab-bar-sticky')?.getBoundingClientRect().height ?? 0;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollTo({ top: section.getBoundingClientRect().top + scrollY - tabs - 12, behavior: smooth ? 'smooth' : 'auto' });
    const heading = section.querySelector<HTMLElement>('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
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

    <!-- Plain words, not chips, so they never read as more period choices. -->
    <nav class="jump" aria-label={t('insights.jump')}>
      {#each SECTIONS as sec (sec.id)}
        <button type="button" data-jump={sec.id} onclick={() => jump(sec.id)}>{t(sec.key)}</button>
      {/each}
    </nav>

    <YearReview {year} />
    <Patterns {year} />
    <Rankings {year} />
    <ValueSignals />
  {/if}
</div>

<style>
  .period {
    margin-bottom: 0.75rem;
  }
  .jump {
    display: flex;
    flex-wrap: wrap;
    column-gap: 1.25rem;
    margin: -0.25rem 0 1rem;
  }
  .jump button {
    min-height: 44px;
    padding: 0;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-amber);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .jump button:hover {
    color: var(--text-heading);
  }
  /* Headings take focus after a jump; the scroll already shows where you are. */
  #viewInsights :global(h2:focus) {
    outline: none;
  }
</style>
