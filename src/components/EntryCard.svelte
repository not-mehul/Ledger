<script lang="ts">
  import { metricAverages, placing, samePlace, scoreChange, standouts, visitsTo, type Standout } from '../domain/context';
  import type { Entry } from '../domain/entry';
  import { HEAVY_WEIGHT, RATING_MAX, activeCategories, metricsIn } from '../domain/metrics';
  import { categoryName, locale, metricName, t } from '../i18n/index.svelte';
  import { formatMonth } from '../lib/dates';
  import { ledger } from '../state/ledger.svelte';
  import CategoryIcon from './ui/CategoryIcon.svelte';
  import Icon from './ui/Icon.svelte';
  import ScoreDial from './ScoreDial.svelte';
  import CityView from './CityView.svelte';
  import Sheet from './Sheet.svelte';

  interface Props {
    entry: Entry;
    open: boolean;
    /** Picked for the side-by-side comparison. */
    comparing?: boolean;
    ontoggle: () => void;
    onedit: () => void;
    ondelete: () => void;
    onshare: () => void;
    oncompare?: () => void;
    /** Opens another visit to the same city. */
    onvisit?: (id: string) => void;
  }

  let { entry, open, comparing = false, ontoggle, onedit, ondelete, onshare, oncompare, onvisit }: Props = $props();

  const score = $derived(ledger.scoreOf(entry));
  const categories = $derived(
    activeCategories(ledger.config)
      .map((cat) => ({ cat, metrics: metricsIn(ledger.config, cat.id).filter((m) => typeof entry.ratings[m.id] === 'number') }))
      .filter((g) => g.metrics.length),
  );
  const visits = $derived(visitsTo(ledger.entries, entry));
  const visitNumber = $derived(visits.findIndex((v) => v.id === entry.id) + 1);

  // Context against the rest of the ledger. Only read while the card is open.
  const others = $derived(ledger.entries.filter((e) => e.id !== entry.id));
  const usual = $derived(metricAverages(others, ledger.config));
  const stand = $derived(standouts(entry, ledger.config, usual, others.length));
  const rank = $derived(score === null ? null : placing(score, ledger.scores, entry.id));

  // Against your latest rating of home, when you've chosen one (Settings).
  const home = $derived(ledger.settings.homeCity);
  const isHome = $derived(!!home && samePlace(entry, home));
  const homeVisit = $derived(home && !isHome ? visitsTo(ledger.entries, home).at(-1) : undefined);
  const homeScore = $derived(homeVisit ? ledger.scoreOf(homeVisit) : null);
  const vsHome = $derived(score !== null && homeScore !== null ? Math.round((score - homeScore) * 10) / 10 : null);
  let cityOpen = $state(false);

  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(1)}`;

  function standoutLine(s: Standout): string {
    return s.delta === null ? `${s.value}/${RATING_MAX}` : t('ledger.vsUsual', { delta: signed(s.delta) });
  }
</script>

<article class="entry-card dd-lift" class:open class:comparing id="card-{entry.id}">
  <button
    type="button"
    class="entry-card-header"
    aria-expanded={open}
    aria-controls="detail-{entry.id}"
    onclick={ontoggle}
  >
    <ScoreDial
      {score}
      size={64}
      stroke={6}
      labelled
      label={score === null ? t('ledger.unrated') : t('ledger.scoreLabel', { score })}
    />
    <span class="entry-city-block">
      <span class="entry-city-name">{entry.city}<span class="entry-region">, {entry.state}</span></span>
      <span class="entry-meta"
        >{formatMonth(entry.date, locale())}{visits.length > 1
          ? ` · ${t('ledger.visitN', { n: visitNumber })}`
          : ''}{isHome ? ` · ${t('home.thisIsHome')}` : ''}</span
      >
    </span>
    <Icon name="chevronDown" class="entry-chevron" />
  </button>

  {#if open}
    <div class="entry-detail settle-in" id="detail-{entry.id}">
      {#if rank || stand || vsHome !== null}
        <dl class="context hairline-grid" data-testid="entry-context">
          {#if rank}
            <div class="context-tile" data-context="rank">
              <dt class="t-field-label">{t('ledger.rank')}</dt>
              <dd class="context-value tabular">{t('ledger.rankValue', { position: rank.position, of: rank.of })}</dd>
            </div>
          {/if}
          {#if vsHome !== null && homeVisit}
            <div class="context-tile" data-context="home">
              <dt class="t-field-label">{t('home.vs')}</dt>
              <dd class="context-value tabular">{signed(vsHome)}</dd>
              <dd class="context-sub" class:up={vsHome > 0} class:down={vsHome < 0}>{t('home.on', { city: homeVisit.city })}</dd>
            </div>
          {/if}
          {#if stand}
            {#each [{ key: 'best', s: stand.best }, { key: 'worst', s: stand.worst }] as item (item.key)}
              {@const comparative = item.s.delta !== null}
              <div class="context-tile" data-context={item.key}>
                <dt class="t-field-label">
                  {item.key === 'best'
                    ? comparative
                      ? t('ledger.standsOut')
                      : t('ledger.best')
                    : comparative
                      ? t('ledger.fallsShort')
                      : t('ledger.weakest')}
                </dt>
                <dd class="context-value">{metricName(item.s.metric)}</dd>
                <dd class="context-sub" class:up={item.key === 'best'} class:down={item.key === 'worst'}>{standoutLine(item.s)}</dd>
              </div>
            {/each}
          {/if}
        </dl>
      {/if}

      {#each categories as { cat, metrics } (cat.id)}
        <div class="mini-cat-label"><CategoryIcon category={cat} size={14} />{categoryName(cat)}</div>
        {#each metrics as m (m.id)}
          {@const val = entry.ratings[m.id] ?? 0}
          {@const avg = usual.get(m.id)}
          <div class="mini-row">
            <span class="mini-name">{metricName(m)}</span>
            <div class="mini-bar-bg">
              <div
                class="mini-bar-fill grow-x"
                style:width="{(val / RATING_MAX) * 100}%"
                style:background={m.weight >= HEAVY_WEIGHT ? 'var(--accent-amber)' : 'var(--accent-sage)'}
              ></div>
              {#if avg !== undefined}
                <span class="usual-tick" style:left="{(avg / RATING_MAX) * 100}%" aria-hidden="true"></span>
              {/if}
            </div>
            <span class="mini-val"
              >{val}/{RATING_MAX}{#if avg !== undefined}<span class="visually-hidden">, {t('ledger.usual', { value: avg.toFixed(1) })}</span>{/if}</span
            >
          </div>
        {/each}
      {/each}
      {#if others.length && categories.length}
        <p class="t-hint usual-hint">{t('ledger.usualHint')}</p>
      {/if}

      {#if visits.length > 1}
        <div class="visits" data-testid="visit-history">
          <div class="mini-cat-label">{t('ledger.visits', { city: entry.city })}</div>
          <ol class="visit-list">
            {#each visits as v, i (v.id)}
              {@const vs = ledger.scoreOf(v)}
              {@const change = i > 0 ? scoreChange(visits[i - 1]!, v, ledger.config) : null}
              <li>
                <button type="button" class="visit-row" class:current={v.id === entry.id} disabled={v.id === entry.id} onclick={() => onvisit?.(v.id)}>
                  <span class="visit-month">{formatMonth(v.date, locale())}</span>
                  <span class="visit-note">{v.id === entry.id ? t('ledger.thisVisit') : ''}</span>
                  {#if change !== null && change !== 0}
                    <span class="visit-change" class:up={change > 0} class:down={change < 0}>{change > 0 ? '▲' : '▼'} {signed(change)}</span>
                  {:else}
                    <span class="visit-change"></span>
                  {/if}
                  <span class="visit-score tabular">{vs === null ? '—' : vs.toFixed(1)}</span>
                </button>
              </li>
            {/each}
          </ol>
          <button type="button" class="city-link" data-action="city" onclick={() => (cityOpen = true)}>{t('city.open', { city: entry.city })}</button>
        </div>
        {#if cityOpen}
          <Sheet title={`${entry.city}, ${entry.state}`} onclose={() => (cityOpen = false)}>
            <CityView
              place={entry}
              onvisit={(id) => {
                cityOpen = false;
                if (id !== entry.id) onvisit?.(id);
              }}
            />
          </Sheet>
        {/if}
      {/if}

      {#if entry.notes}
        <div class="entry-notes-block">
          <div class="entry-notes-label">{t('ledger.notes')}</div>
          <div class="entry-notes-text">{entry.notes}</div>
        </div>
      {/if}

      <!-- Labelled icon actions (style.md §8.23): a word under every icon. -->
      <div class="entry-card-actions icon-actions">
        <button type="button" data-action="edit" onclick={onedit}><Icon name="pencil" size={20} /><span class="icon-action-word">{t('action.edit')}</span></button>
        <button type="button" data-action="share" title={t('action.share')} onclick={onshare}><Icon name="share" size={20} /><span class="icon-action-word">{t('card.share')}</span></button>
        {#if oncompare}
          <button type="button" data-action="compare" aria-pressed={comparing} onclick={oncompare}><Icon name="compare" size={20} /><span class="icon-action-word">{t('action.compare')}</span></button>
        {/if}
        <button type="button" class="is-danger" data-action="delete" onclick={ondelete}><Icon name="trash" size={20} /><span class="icon-action-word">{t('action.delete')}</span></button>
      </div>
    </div>
  {/if}
</article>

<style>
  /* A quiet word with a full-size touch target. */
  .city-link {
    display: inline-flex;
    align-items: center;
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
  .entry-card.comparing {
    border-color: rgba(var(--accent-amber-rgb), 0.55);
  }
  .entry-detail {
    display: block;
  }
  .entry-notes-text {
    white-space: pre-line;
  }
  /* Rank and standouts: a hairline grid of small tiles (style.md §6.3, §8.15). */
  .context {
    /* Flex rather than grid, so an odd tile out stretches instead of leaving a hole. */
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }
  .context-tile {
    flex: 1 1 8.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.75rem 0.875rem;
    background: var(--panel-bg-faint);
    min-width: 0;
  }
  .context-value {
    font-family: var(--font-serif);
    font-size: 1.0625rem;
    line-height: 1.25;
    color: var(--text-heading);
  }
  .context-sub {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  .context-sub.up {
    color: var(--accent-sage);
  }
  .context-sub.down {
    color: var(--accent-amber);
  }

  /* "Your usual" tick over each bar. */
  .mini-bar-bg {
    position: relative;
    overflow: visible;
  }
  .mini-bar-fill {
    border-radius: var(--radius);
  }
  .usual-tick {
    position: absolute;
    top: -3px;
    width: 2px;
    height: 10px;
    margin-left: -1px;
    background: var(--text-dim);
    border-radius: 1px;
  }
  .usual-hint {
    margin-top: 0.75rem;
  }

  .visits {
    margin-top: 1.125rem;
  }
  .visit-list {
    list-style: none;
  }
  .visit-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto 3.25rem;
    gap: 0.75rem;
    align-items: baseline;
    width: 100%;
    min-height: 44px;
    padding: 0.5rem 0;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border-faint);
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: background-color var(--dur-hover);
  }
  .visit-row:hover:not(:disabled) {
    background: var(--hover-bg);
  }
  .visit-row:disabled {
    cursor: default;
    opacity: 1;
  }
  .visit-month {
    font-family: var(--font-serif);
    color: var(--text-heading);
  }
  .visit-row.current .visit-month {
    font-style: italic;
    color: var(--accent-amber);
  }
  .visit-note {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .visit-change {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  .visit-change.up {
    color: var(--accent-sage);
  }
  .visit-change.down {
    color: var(--danger);
  }
  .visit-score {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--text-muted);
    text-align: right;
  }

</style>
