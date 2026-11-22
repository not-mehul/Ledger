<script lang="ts">
  import Icon from './ui/Icon.svelte';
  import { cheer, hatch } from '../lib/delight';
  import { isSameVisit, newEntryId, nextSavedAt, type Entry } from '../domain/entry';
  import { RATING_DEFAULT, activeCategories, activeMetrics, metricsIn } from '../domain/metrics';
  import { placing, samePlace, visitsTo } from '../domain/context';
  import { calcScore, scoreTier } from '../domain/score';
  import { categoryName, locale, t } from '../i18n/index.svelte';
  import { currentMonthString, formatMonth } from '../lib/dates';
  import { loadPlaces, matchPlace, regionFor, type Place } from '../lib/places';
  import { EntryGone, ledger } from '../state/ledger.svelte';
  import { ui } from '../state/ui.svelte';
  import CategoryIcon from './ui/CategoryIcon.svelte';
  import CityField from './CityField.svelte';
  import MetricSlider from './MetricSlider.svelte';
  import MonthPicker from './MonthPicker.svelte';
  import ScoreDial from './ScoreDial.svelte';

  type Located = Pick<Entry, 'country' | 'lat' | 'lon'>;

  let city = $state('');
  let region = $state('');
  let month = $state(currentMonthString());
  let notes = $state('');
  /** Ratings set on this form: loaded from the entry being edited, or moved by the user. */
  let ratings = $state<Record<string, number>>({});
  let located = $state<Located>({});
  /** True until the user moves a slider; a fresh form scores the defaults and says so. */
  let pristine = $state(true);
  let editingId = $state<string | null>(null);
  let saving = $state(false);

  const categories = $derived(activeCategories(ledger.config));
  /**
   * Exactly what gets saved. A new entry rates every visible metric, untouched
   * sliders at their default. An edit keeps the entry's ratings and adds only
   * the sliders moved, so a metric added since the visit stays unrated.
   */
  const formRatings = $derived.by(() => {
    if (editingId) return { ...ratings };
    const all: Record<string, number> = { ...ratings };
    for (const m of activeMetrics(ledger.config)) all[m.id] = ratings[m.id] ?? RATING_DEFAULT;
    return all;
  });
  const score = $derived(calcScore(formRatings, ledger.config));
  const tier = $derived(score === null ? null : scoreTier(score));
  /** Where this score would sit among everything else in the ledger. */
  const placed = $derived(score === null || pristine || !ledger.entries.length ? null : placing(score, ledger.scores, editingId));

  /** The average of the category's rated metrics, or null when none is rated. */
  function categoryAverage(catId: string): number | null {
    const values = metricsIn(ledger.config, catId)
      .map((m) => formRatings[m.id])
      .filter((v): v is number => typeof v === 'number');
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }

  const draft = $derived({ city: city.trim(), state: region.trim(), date: month });

  /** Another entry already logged for this city, region and month. */
  const sameVisit = $derived(
    draft.city && draft.state ? ledger.entries.find((e) => e.id !== editingId && isSameVisit(e, draft)) : undefined,
  );

  /**
   * A new entry for a city already in the ledger (another month): offer to
   * start from the most recent visit's ratings rather than from scratch.
   */
  const returning = $derived.by(() => {
    if (editingId || !pristine || sameVisit) return null;
    if (!draft.city || !draft.state) return null;
    const visits = visitsTo(ledger.entries, draft).filter((e) => e.date !== month);
    return visits[visits.length - 1] ?? null;
  });

  function startFrom(previous: Entry) {
    ratings = { ...previous.ratings };
    pristine = false;
    if (located.lat === undefined && previous.lat !== undefined && samePlace(previous, { city, state: region })) {
      located = { country: previous.country, lat: previous.lat, lon: previous.lon };
    }
    ui.notify(t('form.returningApplied', { month: formatMonth(previous.date, locale()) }));
  }

  function rating(id: string): number {
    return ratings[id] ?? RATING_DEFAULT;
  }

  function reset() {
    city = '';
    region = '';
    month = currentMonthString();
    notes = '';
    ratings = {};
    located = {};
    pristine = true;
    editingId = null;
  }

  function load(entry: Entry) {
    city = entry.city;
    region = entry.state;
    month = entry.date;
    notes = entry.notes;
    ratings = { ...entry.ratings };
    located = { country: entry.country, lat: entry.lat, lon: entry.lon };
    pristine = false;
    editingId = entry.id;
  }

  function editExisting(entry: Entry) {
    load(entry);
    ui.notify(t('toast.loaded', { place: `${entry.city}, ${entry.state}` }));
  }

  // Edit requests come from the ledger and map views.
  $effect(() => {
    const entry = ui.editing;
    if (!entry) return;
    ui.editing = null;
    editExisting(entry);
  });

  // The entry being edited was deleted (here, or by a sync). Keep what's on
  // the form as a new entry, so Save never quietly brings the old one back
  // and nothing typed is lost; an Undo brings back the original to update.
  $effect(() => {
    if (editingId && ledger.status === 'ready' && !ledger.find(editingId)) editingId = null;
  });

  // A new entry started by another app's ledger:// link: the place and month
  // are filled in, the person rates it and saves.
  $effect(() => {
    const prefill = ui.prefill;
    if (!prefill) return;
    ui.prefill = null;
    reset();
    city = prefill.city;
    region = prefill.region;
    if (prefill.month) month = prefill.month;
    if (prefill.country) located = { country: prefill.country };
    ui.notify(t('toast.started', { place: prefill.city }));
    // Place it from the offline list, as picking the suggestion would.
    loadPlaces()
      .then((index) => {
        const place = matchPlace(index, prefill.city, prefill.region || prefill.country || '');
        if (place && city === prefill.city && (!prefill.country || place.country === prefill.country)) {
          if (!prefill.region || region === prefill.region) pickPlace(place);
        }
      })
      .catch((err) => console.warn('Places unavailable:', err));
  });

  function pickPlace(place: Place) {
    region = regionFor(place);
    located = { country: place.country, lat: place.lat, lon: place.lon };
  }

  /**
   * Coordinates from a picked suggestion, else kept from the saved copy of the
   * same visit. A country known without coordinates (from a link) is kept.
   */
  function coordinates(previous: Entry | undefined): Located {
    if (located.lat !== undefined && located.lon !== undefined) return { country: located.country, lat: located.lat, lon: located.lon };
    if (previous?.lat !== undefined && isSameVisit(previous, draft)) {
      return { country: previous.country, lat: previous.lat, lon: previous.lon };
    }
    return located.country ? { country: located.country } : {};
  }

  /** Only defined fields, so an entry never carries `lat: undefined`. */
  function defined<T extends object>(o: T): Partial<T> {
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
  }

  /** Asks before folding this form into a visit that's already logged. */
  function confirmUpdate(existing: Entry): Promise<boolean> {
    return ui.confirm({
      title: t('form.mergeTitle', { place: `${existing.city}, ${formatMonth(existing.date, locale())}` }),
      message: t('form.mergeMessage'),
      action: t('form.mergeAction'),
    });
  }

  async function save() {
    if (!draft.city) return ui.notify(t('form.errorCity'), 'error');
    if (!draft.state) return ui.notify(t('form.errorRegion'), 'error');

    const place = `${draft.city}, ${formatMonth(draft.date, locale())}`;
    // Editing one entry into a visit that another already records would log it twice.
    if (editingId && sameVisit) return ui.notify(t('form.errorDuplicate', { place }), 'error');

    // A new entry for a visit that's already logged: ask, then update that
    // entry without losing anything it has.
    const existing = editingId ? undefined : sameVisit;
    if (existing && !(await confirmUpdate(existing))) return;

    const id = editingId ?? existing?.id ?? newEntryId();
    const previous = ledger.find(id);
    const newNotes = notes.trim();
    const entry: Entry = {
      ...draft,
      ...defined(coordinates(previous)),
      id,
      ratings: existing ? { ...existing.ratings, ...ratings } : { ...formRatings },
      notes: existing && existing.notes ? [existing.notes, newNotes].filter(Boolean).join('\n\n') : newNotes,
      savedAt: nextSavedAt(previous?.savedAt),
    };

    saving = true;
    try {
      await ledger.saveEntry($state.snapshot(entry) as Entry, { update: !!previous });
    } catch (err) {
      if (err instanceof EntryGone) {
        editingId = null;
        ui.notify(t('form.editGone'), 'info');
      } else {
        console.error('Save failed:', err);
        ui.notify(t('toast.saveFailed'), 'error');
      }
      return;
    } finally {
      saving = false;
    }

    const where = `${entry.city}, ${entry.state}`;
    const s = ledger.scoreOf(entry);
    ui.notify(previous ? t('toast.updated', { place: where }) : t('toast.saved', { place: where, score: s ?? '—' }), 'success');
    // The first city in the ledger, and any city rated Exceptional, get a flurry of stamps.
    if (!previous && (ledger.entries.length === 1 || (s ?? 0) >= 85)) cheer(null, { count: (s ?? 0) >= 85 ? 80 : 50 });
    if (s !== null && Math.round(s) === 100) hatch('perfect', t('egg.perfect', { place: where }));
    reset();
  }
</script>

<div id="viewNew" role="tabpanel" aria-labelledby="tabNew">
  <div class="panel panel--raised">
    <div class="section-head section-head--compact">
      <h2>{t('form.location')}</h2>
    </div>
    <div class="city-row">
      <div class="field-group">
        <label class="t-field-label" for="inputCity">{t('form.city')}</label>
        <CityField bind:city onpick={pickPlace} ontype={() => (located = {})} />
      </div>
      <div class="field-group">
        <label class="t-field-label" for="inputState">{t('form.region')}</label>
        <input
          type="text"
          class="input"
          id="inputState"
          placeholder={t('form.regionPlaceholder')}
          autocomplete="off"
          enterkeyhint="next"
          bind:value={region}
          oninput={() => (located = {})}
        />
      </div>
      <div class="field-group">
        <label class="t-field-label" for="inputDate">{t('form.month')}</label>
        <MonthPicker bind:value={month} />
      </div>
    </div>
    {#if located.lat !== undefined}
      <p class="located"><Icon name="pin" size={14} class="located-icon" /> {t('form.located')}</p>
    {/if}
    {#if sameVisit}
      <button type="button" class="notice returning" id="sameVisitNotice" onclick={() => editExisting(sameVisit)}>
        <Icon name="pencil" size={20} />
        <span class="notice-text">
          <span class="notice-title">{t('form.alreadyTitle', { city: sameVisit.city, month: formatMonth(sameVisit.date, locale()) })}</span>
          <span class="notice-detail">{t('form.alreadyDetail')}</span>
        </span>
        <Icon name="chevronRight" class="notice-chevron" />
      </button>
    {/if}
    {#if returning}
      {@const prevScore = ledger.scoreOf(returning)}
      <button type="button" class="notice returning" id="returningNotice" onclick={() => startFrom(returning)}>
        <Icon name="history" size={20} />
        <span class="notice-text">
          <span class="notice-title">{t('form.returningTitle', { city: returning.city })}</span>
          <span class="notice-detail">
            {t('form.returningDetail', {
              when: `${formatMonth(returning.date, locale())}${prevScore === null ? '' : ` · ${prevScore.toFixed(1)}/100`}`,
            })}
          </span>
        </span>
        <Icon name="chevronRight" class="notice-chevron" />
      </button>
    {/if}
  </div>

  <div class="score-panel">
    <div class="score-arc-wrap">
      <ScoreDial {score} ticks />
    </div>
    <div class="score-info" aria-live="polite">
      <div class="t-field-label score-label">{t('form.score')}</div>
      <div class="score-number">
        <span id="scoreDisplay">{score === null ? '—' : score.toFixed(1)}</span><span class="denom"> / 100</span>
      </div>
      <div class="score-desc" id="scoreDesc" style:color={tier ? `var(${tier.cssVar})` : undefined}>
        {tier ? t(`tier.${tier.id}`) : t('form.scoreHint')}
      </div>
      {#if pristine}
        <div class="placing" id="scorePlacing">{t('form.scoreHint')}</div>
      {:else if placed}
        <div class="placing" id="scorePlacing">{t('form.placing', { position: placed.position, of: placed.of })}</div>
      {/if}
    </div>
  </div>

  {#each categories as cat (cat.id)}
    {@const metrics = metricsIn(ledger.config, cat.id)}
    {#if metrics.length}
      {@const average = categoryAverage(cat.id)}
      <div class="panel">
        <div class="section-head">
          <h2 class="cat-heading"><CategoryIcon category={cat} size={22} />{categoryName(cat)}</h2>
          <span class="cat-avg" data-cat={cat.id} aria-label={average === null ? t('form.notRated') : t('form.categoryAverage', { value: average.toFixed(1) })}>{average === null ? '—' : average.toFixed(1)}</span>
        </div>
        {#each metrics as metric (metric.id)}
          <MetricSlider
            {metric}
            rated={typeof formRatings[metric.id] === 'number'}
            bind:value={
              () => rating(metric.id),
              (v) => {
                ratings[metric.id] = Number(v);
                pristine = false;
              }
            }
          />
        {/each}
      </div>
    {/if}
  {/each}

  <div class="panel">
    <div class="section-head section-head--compact">
      <h2><label for="inputNotes">{t('form.impressions')}</label></h2>
    </div>
    <textarea class="textarea" id="inputNotes" placeholder={t('form.notesPlaceholder')} bind:value={notes}></textarea>
  </div>

  <div class="save-row">
    <div class="btn-pair">
      <button type="button" class="btn btn-muted" id="btnClear" onclick={reset}>{t('action.clear')}</button>
      <button type="button" class="btn btn-primary" id="btnSave" disabled={saving} onclick={save}>
        {editingId ? t('form.update') : t('form.save')}
      </button>
    </div>
  </div>
</div>

<style>
  .returning {
    margin-top: 1rem;
  }
  .placing {
    margin-top: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  .cat-avg {
    margin-left: auto;
    font-family: var(--font-serif);
    font-size: 1.375rem;
    line-height: 1;
    color: var(--accent-amber);
    font-variant-numeric: tabular-nums;
  }
  .located {
    margin-top: 0.75rem;
    font-size: 0.625rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent-sage);
    font-family: var(--font-mono);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
</style>
