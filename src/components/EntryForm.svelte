<script lang="ts">
  import { deletePhoto } from '../data/photo-store';
  import { isSameVisit, newEntryId, type Entry, type Photo } from '../domain/entry';
  import { RATING_DEFAULT, activeCategories, activeMetrics, metricsIn } from '../domain/metrics';
  import { placing, samePlace, visitsTo } from '../domain/context';
  import { calcScore, scoreTier } from '../domain/score';
  import { categoryName, locale, t } from '../i18n/index.svelte';
  import { currentMonthString, formatMonth } from '../lib/dates';
  import { loadPlaces, matchPlace, regionFor, type Place } from '../lib/places';
  import { ledger } from '../state/ledger.svelte';
  import { ui } from '../state/ui.svelte';
  import CityField from './CityField.svelte';
  import MetricSlider from './MetricSlider.svelte';
  import MonthPicker from './MonthPicker.svelte';
  import PhotoStrip from './PhotoStrip.svelte';
  import ScoreDial from './ScoreDial.svelte';

  type Located = Pick<Entry, 'country' | 'lat' | 'lon'>;

  let city = $state('');
  let region = $state('');
  let month = $state(currentMonthString());
  let notes = $state('');
  let photos = $state<Photo[]>([]);
  let ratings = $state<Record<string, number>>({});
  let located = $state<Located>({});
  /** True until the user moves a slider, so a fresh form shows "—". */
  let pristine = $state(true);
  let editingId = $state<string | null>(null);
  let savedPhotoIds = $state.raw<ReadonlySet<string>>(new Set());
  let saving = $state(false);

  const categories = $derived(activeCategories(ledger.config));
  /** Every visible metric, untouched sliders at their default — exactly what gets saved. */
  const formRatings = $derived.by(() => {
    const all: Record<string, number> = { ...ratings };
    for (const m of activeMetrics(ledger.config)) all[m.id] = ratings[m.id] ?? RATING_DEFAULT;
    return all;
  });
  const score = $derived(pristine ? null : calcScore(formRatings, ledger.config));
  const tier = $derived(score === null ? null : scoreTier(score));
  /** Where this score would sit among everything else in the ledger. */
  const placed = $derived(score === null || !ledger.entries.length ? null : placing(score, ledger.scores, editingId));

  function categoryAverage(catId: string): number {
    const values = metricsIn(ledger.config, catId).map((m) => formRatings[m.id]!);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * A new entry for a city already in the ledger (another month): offer to
   * start from the most recent visit's ratings rather than from scratch.
   */
  const returning = $derived.by(() => {
    if (editingId || !pristine) return null;
    const draft = { city: city.trim(), state: region.trim() };
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
    photos = [];
    ratings = {};
    located = {};
    pristine = true;
    editingId = null;
    savedPhotoIds = new Set();
  }

  function load(entry: Entry) {
    city = entry.city;
    region = entry.state;
    month = entry.date;
    notes = entry.notes;
    photos = [...entry.photos];
    ratings = { ...entry.ratings };
    located = { country: entry.country, lat: entry.lat, lon: entry.lon };
    pristine = false;
    editingId = entry.id;
    savedPhotoIds = new Set(entry.photos.map((p) => p.id));
  }

  function clear() {
    // Photos added to this form but never saved would otherwise linger.
    for (const p of photos) if (!savedPhotoIds.has(p.id)) void deletePhoto(p.id);
    reset();
  }

  // Edit requests come from the ledger and map views.
  $effect(() => {
    const entry = ui.editing;
    if (!entry) return;
    load(entry);
    ui.editing = null;
    ui.notify(t('toast.loaded', { place: `${entry.city}, ${entry.state}` }));
  });

  // A new entry started by another app's ledger:// link: the place and month
  // are filled in, the person rates it and saves.
  $effect(() => {
    const prefill = ui.prefill;
    if (!prefill) return;
    ui.prefill = null;
    clear();
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

  /** Coordinates from a picked suggestion, else kept from the saved copy of the same visit. */
  function coordinates(previous: Entry | undefined, draft: Pick<Entry, 'city' | 'state' | 'date'>): Located {
    if (located.lat !== undefined) return located;
    if (previous?.lat !== undefined && isSameVisit(previous, draft)) {
      return { country: previous.country, lat: previous.lat, lon: previous.lon };
    }
    return {};
  }

  async function save() {
    const c = city.trim();
    const r = region.trim();
    if (!c) return ui.notify(t('form.errorCity'), 'error');
    if (!r) return ui.notify(t('form.errorRegion'), 'error');


    const draft = { city: c, state: r, date: month };
    // A new entry for a visit that's already logged updates that entry instead.
    const duplicate = editingId ? undefined : ledger.entries.find((e) => isSameVisit(e, draft));
    const id = editingId ?? duplicate?.id ?? newEntryId();
    const previous = ledger.find(id);
    const entry: Entry = {
      ...draft,
      ...coordinates(previous, draft),
      id,
      ratings: { ...formRatings },
      notes: notes.trim(),
      photos: duplicate ? [...duplicate.photos, ...photos] : photos,
      savedAt: new Date().toISOString(),
    };

    saving = true;
    try {
      await ledger.saveEntry($state.snapshot(entry) as Entry);
    } catch (err) {
      console.error('Save failed:', err);
      ui.notify(t('toast.saveFailed'), 'error');
      return;
    } finally {
      saving = false;
    }

    const place = `${entry.city}, ${entry.state}`;
    const s = ledger.scoreOf(entry);
    ui.notify(previous ? t('toast.updated', { place }) : t('toast.saved', { place, score: s ?? '—' }), 'success');
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
      <p class="located">◉ {t('form.located')}</p>
    {/if}
    {#if returning}
      {@const prevScore = ledger.scoreOf(returning)}
      <button type="button" class="notice returning" id="returningNotice" onclick={() => startFrom(returning)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
        </svg>
        <span class="notice-text">
          <span class="notice-title">{t('form.returningTitle', { city: returning.city })}</span>
          <span class="notice-detail">
            {t('form.returningDetail', {
              when: `${formatMonth(returning.date, locale())}${prevScore === null ? '' : ` · ${prevScore.toFixed(1)}/100`}`,
            })}
          </span>
        </span>
        <svg class="notice-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
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
      {#if placed}
        <div class="placing" id="scorePlacing">{t('form.placing', { position: placed.position, of: placed.of })}</div>
      {/if}
    </div>
  </div>

  {#each categories as cat (cat.id)}
    {@const metrics = metricsIn(ledger.config, cat.id)}
    {#if metrics.length}
      <div class="panel">
        <div class="section-head">
          <h2>{categoryName(cat)}</h2>
          {#if !pristine}
            {@const avg = categoryAverage(cat.id)}
            <span class="cat-avg" data-cat={cat.id} aria-label={t('form.categoryAverage', { value: avg.toFixed(1) })}>{avg.toFixed(1)}</span>
          {/if}
        </div>
        {#each metrics as metric (metric.id)}
          <MetricSlider
            {metric}
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

  <div class="panel">
    <div class="section-head section-head--compact">
      <h2>{t('form.photos')}</h2>
    </div>
    <PhotoStrip bind:photos saved={savedPhotoIds} />
  </div>

  <div class="save-row">
    <span class="t-hint save-hint">{t('app.designedBy')}</span>
    <button type="button" class="btn btn-muted" id="btnClear" onclick={clear}>{t('action.clear')}</button>
    <button type="button" class="btn btn-primary" id="btnSave" disabled={saving} onclick={save}>
      {editingId ? t('form.update') : t('form.save')}
    </button>
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
  }
</style>
