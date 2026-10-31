<script lang="ts">
  import { Dialog } from '@capacitor/dialog';
  import { tick } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { filterEntries, sortEntries, type Entry, type SortMode } from '../domain/entry';
  import { t } from '../i18n/index.svelte';
  import { ledger } from '../state/ledger.svelte';
  import { shareEntryCard } from '../state/share';
  import { ui } from '../state/ui.svelte';
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

  async function remove(entry: Entry) {
    const place = `${entry.city}, ${entry.state}`;
    const { value } = await Dialog.confirm({
      title: t('delete.title'),
      message: t('delete.message', { place }),
      okButtonTitle: t('action.delete'),
      cancelButtonTitle: t('action.cancel'),
    });
    if (!value) return;
    try {
      await ledger.deleteEntry(entry.id);
      ui.notify(t('toast.deleted'));
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
    <input type="search" id="searchLogbook" class="search-bar" placeholder={t('ledger.search')} aria-label={t('ledger.search')} bind:value={query} />
    <div class="sort-row" role="group" aria-label={t('ledger.sort')}>
      <span class="sort-label">{t('ledger.sort')}</span>
      {#each SORTS as s (s.mode)}
        <button type="button" class="sort-btn" class:active={sortMode === s.mode} data-sort={s.mode} aria-pressed={sortMode === s.mode} onclick={() => (sortMode = s.mode)}>
          {t(s.key)}
        </button>
      {/each}
    </div>
  </div>

  <div id="entriesList">
    {#if !ledger.entries.length}
      <div class="empty-state">
        <p class="empty-title">{t('ledger.emptyTitle')}</p>
        <small>{t('ledger.emptyHint')}</small>
      </div>
    {:else if !visible.length}
      <div class="empty-state">
        <p class="empty-title">{t('ledger.noMatchTitle')}</p>
        <small>{t('ledger.noMatchHint')}</small>
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
