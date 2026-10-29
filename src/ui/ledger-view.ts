import { filterEntries, sortEntries, type Entry, type SortMode } from '../domain/entry';
import { CATEGORIES, RATING_MAX, metricsIn } from '../domain/metrics';
import { scoreTier } from '../domain/score';
import { formatMonth } from '../lib/dates';
import { byId, esc, plural } from './dom';

const ARC_CIRCUMFERENCE = 251.33;

export interface LedgerViewActions {
  onEdit(id: string): void;
  onDelete(id: string): void;
}

function emptyState(title: string, hint: string): string {
  return `<div class="empty-state">
    <p class="empty-title">${title}</p>
    <small>${hint}</small>
  </div>`;
}

function cardHtml(e: Entry): string {
  const { color } = scoreTier(e.score);
  const offset = (ARC_CIRCUMFERENCE - (e.score / 100) * ARC_CIRCUMFERENCE).toFixed(2);
  const id = esc(e.id);

  const metrics = CATEGORIES.map(
    (cat) => `
      <div class="mini-cat-label">${esc(cat.label)}</div>
      ${metricsIn(cat.id)
        .map((m) => {
          const val = e.ratings[m.id] ?? 0;
          return `<div class="mini-row">
            <span class="mini-name">${esc(m.label)}</span>
            <div class="mini-bar-bg">
              <div class="mini-bar-fill" style="width:${(val / RATING_MAX) * 100}%;background:${m.high ? '#d4a574' : '#9fb3a0'};"></div>
            </div>
            <span class="mini-val">${val}/${RATING_MAX}</span>
          </div>`;
        })
        .join('')}`,
  ).join('');

  const notes = e.notes
    ? `<div class="entry-notes-block">
        <div class="entry-notes-label">Notes</div>
        <div class="entry-notes-text">${esc(e.notes).replaceAll('\n', '<br/>')}</div>
      </div>`
    : '';

  return `<article class="entry-card" id="card-${id}">
    <button type="button" class="entry-card-header" data-action="toggle" data-id="${id}"
      aria-expanded="false" aria-controls="detail-${id}">
      <svg class="entry-score-svg" viewBox="0 0 100 100" fill="none" role="img" aria-label="Score ${e.score} out of 100">
        <circle cx="50" cy="50" r="40" stroke="rgba(68,64,60,0.25)" stroke-width="6"/>
        <circle cx="50" cy="50" r="40" stroke="${color}" stroke-width="6"
          stroke-dasharray="${ARC_CIRCUMFERENCE}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(-90 50 50)"/>
        <text x="50" y="56" text-anchor="middle"
          font-family="ui-monospace,monospace" font-size="22" fill="${color}">${e.score}</text>
      </svg>
      <span class="entry-city-block">
        <span class="entry-city-name">${esc(e.city)}<span class="entry-region">, ${esc(e.state)}</span></span>
        <span class="entry-meta">${esc(formatMonth(e.date))}</span>
      </span>
      <svg class="entry-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
    <div class="entry-detail" id="detail-${id}">
      ${metrics}
      ${notes}
      <div class="entry-card-actions">
        <button type="button" class="btn btn-ghost" data-action="edit" data-id="${id}">Edit / Load into Form</button>
        <button type="button" class="btn btn-danger" data-action="delete" data-id="${id}">Delete</button>
      </div>
    </div>
  </article>`;
}

/** The "Ledger" tab: searchable, sortable list of saved entries. */
export class LedgerView {
  private readonly list = byId('entriesList');
  private readonly count = byId('logbookCount');
  private readonly search = byId<HTMLInputElement>('searchLogbook');
  private readonly sortButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-sort]')];

  private entries: readonly Entry[] = [];
  private sortMode: SortMode = 'date';

  constructor(actions: LedgerViewActions) {
    this.search.addEventListener('input', () => this.render());

    for (const btn of this.sortButtons) {
      btn.addEventListener('click', () => {
        this.sortMode = btn.dataset.sort as SortMode;
        for (const b of this.sortButtons) {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.setAttribute('aria-pressed', String(active));
        }
        this.render();
      });
    }

    this.list.addEventListener('click', (ev) => {
      const target = (ev.target as Element).closest<HTMLElement>('[data-action]');
      const id = target?.dataset.id;
      if (!target || !id) return;
      switch (target.dataset.action) {
        case 'toggle':
          this.toggle(target, id);
          break;
        case 'edit':
          actions.onEdit(id);
          break;
        case 'delete':
          actions.onDelete(id);
          break;
      }
    });
  }

  setEntries(entries: readonly Entry[]): void {
    this.entries = entries;
    this.render();
  }

  render(): void {
    this.count.textContent = plural(this.entries.length, 'entry', 'entries');

    if (!this.entries.length) {
      this.list.innerHTML = emptyState('No cities logged yet.', 'Rate a city in the Entry tab to begin.');
      return;
    }

    const visible = sortEntries(filterEntries(this.entries, this.search.value), this.sortMode);
    this.list.innerHTML = visible.length
      ? visible.map(cardHtml).join('')
      : emptyState('No matches found.', 'Try adjusting your search.');
  }

  private toggle(header: HTMLElement, id: string): void {
    const open = document.getElementById(`card-${id}`)?.classList.toggle('open') ?? false;
    header.setAttribute('aria-expanded', String(open));
  }
}
