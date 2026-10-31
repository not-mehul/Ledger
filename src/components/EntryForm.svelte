<script lang="ts">
  import { deletePhoto } from '../data/photo-store';
  import { isSameVisit, newEntryId, type Entry, type Photo } from '../domain/entry';
  import { RATING_DEFAULT, activeCategories, activeMetrics, metricsIn } from '../domain/metrics';
  import { calcScore, scoreTier } from '../domain/score';
  import { categoryName, t } from '../i18n/index.svelte';
  import { currentMonthString } from '../lib/dates';
  import { regionFor, type Place } from '../lib/places';
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
        <label class="field-label" for="inputCity">{t('form.city')}</label>
        <CityField bind:city onpick={pickPlace} ontype={() => (located = {})} />
      </div>
      <div class="field-group">
        <label class="field-label" for="inputState">{t('form.region')}</label>
        <input
          type="text"
          class="field-input"
          id="inputState"
          placeholder={t('form.regionPlaceholder')}
          autocomplete="off"
          enterkeyhint="next"
          bind:value={region}
          oninput={() => (located = {})}
        />
      </div>
      <div class="field-group">
        <label class="field-label" for="inputDate">{t('form.month')}</label>
        <MonthPicker bind:value={month} />
      </div>
    </div>
    {#if located.lat !== undefined}
      <p class="located">◉ {t('form.located')}</p>
    {/if}
  </div>

  <div class="score-panel">
    <div class="score-arc-wrap">
      <ScoreDial {score} />
    </div>
    <div class="score-info" aria-live="polite">
      <div class="score-label">{t('form.score')}</div>
      <div class="score-number">
        <span id="scoreDisplay">{score === null ? '—' : score.toFixed(1)}</span><span> / 100</span>
      </div>
      <div class="score-desc" id="scoreDesc" style:color={tier ? `var(${tier.cssVar})` : undefined}>
        {tier ? t(`tier.${tier.id}`) : t('form.scoreHint')}
      </div>
    </div>
  </div>

  {#each categories as cat (cat.id)}
    {@const metrics = metricsIn(ledger.config, cat.id)}
    {#if metrics.length}
      <div class="panel">
        <div class="section-head"><h2>{categoryName(cat)}</h2></div>
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
    <textarea class="notes-area" id="inputNotes" placeholder={t('form.notesPlaceholder')} bind:value={notes}></textarea>
  </div>

  <div class="panel">
    <div class="section-head section-head--compact">
      <h2>{t('form.photos')}</h2>
    </div>
    <PhotoStrip bind:photos saved={savedPhotoIds} />
  </div>

  <div class="save-row">
    <span class="save-hint">{t('app.designedBy')}</span>
    <button type="button" class="btn btn-ghost" id="btnClear" onclick={clear}>{t('action.clear')}</button>
    <button type="button" class="btn btn-primary" id="btnSave" disabled={saving} onclick={save}>
      {editingId ? t('form.update') : t('form.save')}
    </button>
  </div>
</div>

<style>
  .located {
    margin-top: 0.75rem;
    font-size: 0.625rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent-sage);
    font-family: var(--font-mono);
  }
</style>
