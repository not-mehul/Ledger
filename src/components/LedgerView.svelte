<script lang="ts">
  import { tick } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { filterEntries, sortEntries, type Entry, type SortMode } from '../domain/entry';
  import { t } from '../i18n/index.svelte';
  import { ledger } from '../state/ledger.svelte';
  import { shareEntryCard } from '../state/share';
  import { ui } from '../state/ui.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import EntryCard from './EntryCard.svelte';
  import Lightbox from './Lightbox.svelte';

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
    void tick().then(() => document.getElementById(`card-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
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
      {#each visible as entry (entry.id)}
        <EntryCard
          {entry}
          open={openIds.has(entry.id)}
          ontoggle={() => toggle(entry.id)}
          onedit={() => ui.edit(entry)}
          ondelete={() => void remove(entry)}
          onshare={() => void share(entry)}
          onphoto={(index) => (viewer = { entry, index })}
        />
      {/each}
    {/if}
  </div>
</div>

{#if viewer}
  <Lightbox photos={viewer.entry.photos} bind:index={viewer.index} onclose={() => (viewer = null)} />
{/if}
