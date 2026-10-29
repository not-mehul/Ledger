import { newEntryId, type Entry } from '../domain/entry';
import { CATEGORIES, METRICS, RATING_DEFAULT, RATING_MAX, RATING_MIN, metricsIn, type Metric } from '../domain/metrics';
import { calcScore, ratingColor, scoreTier, type Ratings } from '../domain/score';
import { currentMonthString } from '../lib/dates';
import { byId, esc } from './dom';
import { MonthPicker } from './month-picker';

const ARC_CIRCUMFERENCE = 251.33;

export type FormDraft = Omit<Entry, 'id' | 'savedAt'>;

function metricHtml(m: Metric): string {
  return `
    <div class="metric-item">
      <div class="metric-header">
        <label class="metric-name" for="sl-${m.id}">${esc(m.label)}</label>
        <span class="metric-val" id="disp-${m.id}">${RATING_DEFAULT}<span class="denom">/${RATING_MAX}</span></span>
      </div>
      <div class="slider-wrap">
        <input type="range" class="metric-slider" id="sl-${m.id}"
          min="${RATING_MIN}" max="${RATING_MAX}" value="${RATING_DEFAULT}" step="1"
          data-metric="${m.id}">
      </div>
      <div class="slider-footer" aria-hidden="true">
        <div class="slider-ends">
          <span>${esc(m.lo)}</span>
          <span>${esc(m.hi)}</span>
        </div>
        <span class="slider-weight${m.high ? ' is-high' : ''}">×${m.weight}</span>
      </div>
    </div>`;
}

/** The "Entry" tab: location, month, metric sliders, live score and notes. */
export class EntryForm {
  readonly monthPicker = new MonthPicker();

  private readonly city = byId<HTMLInputElement>('inputCity');
  private readonly state = byId<HTMLInputElement>('inputState');
  private readonly notes = byId<HTMLTextAreaElement>('inputNotes');
  private readonly saveButton = byId<HTMLButtonElement>('btnSave');
  private readonly scoreArc = byId('scoreArc');
  private readonly scoreDisplay = byId('scoreDisplay');
  private readonly scoreDesc = byId('scoreDesc');
  private readonly sliders = new Map<string, HTMLInputElement>();

  /** Id of the entry loaded for editing, or null when composing a new one. */
  editingId: string | null = null;

  constructor() {
    byId('metricPanels').innerHTML = CATEGORIES.map(
      (cat) => `
        <div class="panel">
          <div class="section-head"><h2>${esc(cat.title)}</h2></div>
          ${metricsIn(cat.id).map(metricHtml).join('')}
        </div>`,
    ).join('');

    for (const m of METRICS) {
      const slider = byId<HTMLInputElement>(`sl-${m.id}`);
      this.sliders.set(m.id, slider);
      this.paintSlider(m.id, RATING_DEFAULT);
      slider.addEventListener('input', () => {
        this.paintSlider(m.id, Number(slider.value));
        this.paintScore();
      });
    }

    this.city.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.state.focus();
    });
    this.state.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.state.blur();
    });
  }

  /** Reads the form, returning an error message if it's incomplete. */
  read(): { draft: FormDraft } | { error: string } {
    const city = this.city.value.trim();
    const state = this.state.value.trim();
    if (!city) return { error: 'Please enter a city name.' };
    if (!state) return { error: 'Please enter a state or country.' };

    const ratings = this.ratings();
    return {
      draft: {
        city,
        state,
        date: this.monthPicker.value,
        score: calcScore(ratings),
        ratings,
        notes: this.notes.value.trim(),
      },
    };
  }

  /** Builds the entry to persist from a draft, keeping the id when editing. */
  toEntry(draft: FormDraft, id = this.editingId ?? newEntryId()): Entry {
    return { ...draft, id, savedAt: new Date().toISOString() };
  }

  load(entry: Entry): void {
    this.city.value = entry.city;
    this.state.value = entry.state;
    this.notes.value = entry.notes;
    this.monthPicker.value = entry.date;
    for (const m of METRICS) this.setRating(m.id, entry.ratings[m.id] ?? RATING_DEFAULT);
    this.paintScore();
    this.editingId = entry.id;
    this.saveButton.textContent = 'Update Entry';
  }

  reset(): void {
    this.city.value = '';
    this.state.value = '';
    this.notes.value = '';
    this.monthPicker.value = currentMonthString();
    for (const m of METRICS) this.setRating(m.id, RATING_DEFAULT);

    this.scoreDisplay.textContent = '—';
    this.scoreArc.setAttribute('stroke-dashoffset', String(ARC_CIRCUMFERENCE));
    this.scoreArc.setAttribute('stroke', '#d4a574');
    this.scoreDesc.textContent = 'Rate the metrics below to calculate your score.';
    this.scoreDesc.style.color = '';

    this.editingId = null;
    this.saveButton.textContent = 'Save Entry';
  }

  private ratings(): Ratings {
    const r: Ratings = {};
    for (const [id, slider] of this.sliders) r[id] = Number(slider.value);
    return r;
  }

  private setRating(id: string, value: number): void {
    this.sliders.get(id)!.value = String(value);
    this.paintSlider(id, value);
  }

  private paintSlider(id: string, value: number): void {
    const slider = this.sliders.get(id)!;
    const display = byId(`disp-${id}`);
    const isLow = value <= 3;
    const isHigh = value >= 8;

    display.innerHTML = `${value}<span class="denom">/${RATING_MAX}</span>`;
    display.className = `metric-val${isLow ? ' low-val' : isHigh ? ' high-val' : ''}`;
    slider.classList.toggle('is-low', isLow);
    slider.classList.toggle('is-high', isHigh);

    const pct = (((value - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100).toFixed(2);
    slider.style.background = `linear-gradient(to right, ${ratingColor(value)} ${pct}%, rgba(68,64,60,0.4) ${pct}%)`;
  }

  private paintScore(): void {
    const score = calcScore(this.ratings());
    const { color, description } = scoreTier(score);
    const offset = ARC_CIRCUMFERENCE - (score / 100) * ARC_CIRCUMFERENCE;

    this.scoreDisplay.textContent = score.toFixed(1);
    this.scoreArc.setAttribute('stroke-dashoffset', offset.toFixed(2));
    this.scoreArc.setAttribute('stroke', color);
    this.scoreDesc.textContent = description;
    this.scoreDesc.style.color = color;
  }
}
