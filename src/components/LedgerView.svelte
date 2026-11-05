<script lang="ts">
  import { tick } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { COMPARE_MAX } from '../domain/compare';
  import { thisMonthBefore } from '../domain/context';
  import { filterEntries, sortEntries, type Entry, type SortMode } from '../domain/entry';
  import { locale, t } from '../i18n/index.svelte';
  import { formatMonth } from '../lib/dates';
  import { ledger } from '../state/ledger.svelte';
  import { shareEntryCard } from '../state/share';
  import { ui } from '../state/ui.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import CompareView from './CompareView.svelte';
  import EntryCard from './EntryCard.svelte';
  import Lightbox from './Lightbox.svelte';
  import Sheet from './Sheet.svelte';

  let query = $state('');
  let sortMode = $state<SortMode>('date');
  const openIds = new SvelteSet<string>();
  let viewer = $state<{ entry: Entry; index: number } | null>(null);

  const visible = $derived(sortEntries(filterEntries(ledger.entries, query), sortMode, ledger.scoreOf));
  const SORTS: { mode: SortMode; key: 'ledger.sortDate' | 'ledger.sortScore' | 'ledger.sortCity' }[] = [
    { mode: 'date', key: 'ledger.sortDate' },
    { mode: 'score', key: 'ledger.sortScore' },
    { mode: 'city', key: 'ledger.sortCity' },
  ];

  /** Sorted by date, the list is broken into years with a small summary each. */
  const groups = $derived.by(() => {
    if (sortMode !== 'date') return [{ year: null as string | null, entries: visible, average: null as number | null }];
    const out: { year: string | null; entries: Entry[]; average: number | null }[] = [];
    for (const e of visible) {
      const year = e.date.slice(0, 4);
      const last = out[out.length - 1];
      if (last?.year === year) last.entries.push(e);
      else out.push({ year, entries: [e], average: null });
    }
    for (const g of out) {
      const scores = g.entries.map(ledger.scoreOf).filter((s): s is number => s !== null);
      g.average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    }
    return out;
  });

  /** "In November 2024 you were in Lisbon": the latest visit from this month in an earlier year. */
  const memory = $derived(thisMonthBefore(ledger.entries)[0] ?? null);

  const compared = $derived(ui.compareIds.map((id) => ledger.find(id)).filter((e): e is Entry => !!e));
  // Drop deleted entries from the comparison.
  $effect(() => {
    if (compared.length !== ui.compareIds.length) ui.compareIds = compared.map((e) => e.id);
  });

  function toggleCompare(entry: Entry) {
    if (!ui.toggleCompare(entry.id, COMPARE_MAX)) ui.notify(t('compare.full', { max: COMPARE_MAX }));
  }

  function focus(id: string) {
    ui.compareOpen = false;
    ui.showInLedger(id);
  }

  function toggle(id: string) {
    if (!openIds.delete(id)) openIds.add(id);
  }

  // Arriving from the map: expand and scroll to the chosen entry.
  $effect(() => {
    const id = ui.focusEntryId;
    if (!id) return;
    ui.focusEntryId = null;
    query = '';
    openIds.add(id);
    void tick().then(() => {
      const card = document.getElementById(`card-${id}`);
      card?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      // Light the card's frame for a moment so the eye finds it.
      card?.classList.add('arrived');
      setTimeout(() => card?.classList.remove('arrived'), 700);
    });
  });

  // Deleting is undoable for a few seconds instead of confirmed (style.md §8.12).
  // The photos stay on disk until the toast goes without an undo.
  async function remove(entry: Entry) {
    try {
      const removed = await ledger.deleteEntry(entry.id);
      if (!removed) return;
      ui.notify(t('toast.deleted'), 'info', {
        label: t('action.undo'),
        run: () =>
          void ledger.restoreEntry(removed).catch((err: unknown) => {
            console.error('Undo failed:', err);
            ui.notify(t('toast.saveFailed'), 'error');
          }),
        dismissed: () => ledger.forgetPhotos(removed),
      });
    } catch (err) {
      console.error('Delete failed:', err);
      ui.notify(t('toast.deleteFailed'), 'error');
    }
  }

  async function share(entry: Entry) {
    try {
      await shareEntryCard(entry);
    } catch (err) {
      console.error('Share card failed:', err);
      ui.notify(t('toast.shareFailed'), 'error');
    }
  }
</script>

<div id="viewLogbook" role="tabpanel" aria-labelledby="tabLogbook">
  <div class="logbook-header">
    <h2>{t('ledger.title')}</h2>
    <span class="logbook-count" id="logbookCount">{t('status.entries', { count: ledger.entries.length })}</span>
  </div>

  <div class="logbook-controls">
    <input
      type="search"
      id="searchLogbook"
      class="input search-bar"
      placeholder={t('ledger.search')}
      aria-label={t('ledger.search')}
      enterkeyhint="search"
      bind:value={query}
    />
    <div class="sort-row">
      <span class="t-field-label" id="sortLabel">{t('ledger.sort')}</span>
      <div class="segmented" role="radiogroup" aria-labelledby="sortLabel">
        {#each SORTS as s (s.mode)}
          <button type="button" role="radio" data-sort={s.mode} aria-checked={sortMode === s.mode} onclick={() => (sortMode = s.mode)}>
            {t(s.key)}
          </button>
        {/each}
      </div>
    </div>
  </div>

  {#if memory && !query}
    {@const memoryNote = memory.notes.trim()}
    <button type="button" class="notice memory" id="memoryNotice" onclick={() => focus(memory.id)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />
      </svg>
      <span class="notice-text">
        <span class="notice-title">{t('ledger.thisMonth', { month: formatMonth(memory.date, locale()), city: memory.city })}</span>
        {#if memoryNote}
          <span class="notice-detail memory-note">{memoryNote.length > 110 ? `${memoryNote.slice(0, 110).trimEnd()}…` : memoryNote}</span>
        {/if}
      </span>
      <svg class="notice-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  {/if}

  <div id="entriesList">
    {#if !ledger.entries.length}
      <EmptyState
        icon="map-pin"
        title={t('ledger.emptyTitle')}
        text={t('ledger.emptyHint')}
        action={t('ledger.addFirst')}
        onaction={() => ui.go('entry')}
      />
    {:else if !visible.length}
      <div class="empty-match">
        <p class="t-hint" id="noMatch">{t('ledger.noMatchHint')}</p>
        <button type="button" class="btn btn-muted" onclick={() => (query = '')}>{t('ledger.clearSearch')}</button>
      </div>
    {:else}
      {#each groups as group (group.year ?? 'all')}
        {#if group.year}
          <h3 class="year-group" data-year={group.year}>
            <span class="year-group-year">{group.year}</span>
            <span class="year-group-meta"
              >{t('map.cities', { count: group.entries.length })}{group.average === null
                ? ''
                : ` · ${t('ledger.yearAverage', { score: group.average.toFixed(1) })}`}</span
            >
          </h3>
        {/if}
        {#each group.entries as entry (entry.id)}
          <EntryCard
            {entry}
            open={openIds.has(entry.id)}
            comparing={ui.compareIds.includes(entry.id)}
            ontoggle={() => toggle(entry.id)}
            onedit={() => ui.edit(entry)}
            ondelete={() => void remove(entry)}
            onshare={() => void share(entry)}
            onphoto={(index) => (viewer = { entry, index })}
            oncompare={() => toggleCompare(entry)}
            onvisit={focus}
          />
        {/each}
      {/each}
    {/if}
  </div>

  {#if compared.length}
    <div class="compare-tray" id="compareTray" role="region" aria-label={t('compare.tray', { count: compared.length })}>
      <div class="tray-picks">
        {#each compared as e (e.id)}
          <span class="chip chip-tag tray-chip">
            {e.city}
            <button type="button" class="tray-remove" aria-label={t('compare.remove', { city: e.city })} onclick={() => ui.toggleCompare(e.id, COMPARE_MAX)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </span>
        {/each}
      </div>
      {#if compared.length < 2}
        <p class="t-hint tray-hint">{t('compare.pickAnother')}</p>
      {/if}
      <div class="tray-actions">
        <button type="button" class="btn btn-muted" onclick={() => (ui.compareIds = [])}>{t('compare.clear')}</button>
        <button type="button" class="btn btn-primary" id="btnCompare" disabled={compared.length < 2} onclick={() => (ui.compareOpen = true)}>
          {t('action.compare')}
        </button>
      </div>
    </div>
  {/if}
</div>

{#if ui.compareOpen && compared.length >= 2}
  <Sheet title={t('compare.title')} onclose={() => (ui.compareOpen = false)}>
    <CompareView entries={compared} config={ledger.config} onopen={focus} />
  </Sheet>
{/if}

{#if viewer}
  <Lightbox photos={viewer.entry.photos} bind:index={viewer.index} onclose={() => (viewer = null)} />
{/if}

<style>
  .memory {
    margin-bottom: 1.5rem;
  }
  .memory-note {
    font-family: var(--font-serif);
    font-style: italic;
  }
  .year-group {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    margin: 1.75rem 0 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-soft);
    font-weight: 400;
  }
  .year-group:first-child {
    margin-top: 0;
  }
  .year-group-year {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 1.25rem;
    color: var(--text-heading);
    font-variant-numeric: tabular-nums;
  }
  .year-group-meta {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .compare-tray {
    position: sticky;
    bottom: calc(var(--inset-bottom) + 0.75rem);
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    background: var(--modal-bg);
    border: 1px solid rgba(var(--accent-amber-rgb), 0.3);
    border-radius: var(--radius);
    box-shadow: 0 12px 40px rgba(var(--shadow-rgb), calc(0.5 * var(--shadow-strength)));
  }
  .tray-picks {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }
  .tray-chip {
    padding-right: 0.25rem;
  }
  .tray-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
  }
  .tray-remove:hover {
    color: var(--text-heading);
  }
  .tray-hint {
    width: 100%;
    order: 3;
  }
  .tray-actions {
    display: flex;
    gap: 0.5rem;
  }
</style>
