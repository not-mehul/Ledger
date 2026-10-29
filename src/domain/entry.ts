import { normalizeMonth } from '../lib/dates';
import { METRICS, RATING_DEFAULT, RATING_MAX, RATING_MIN } from './metrics';
import { calcScore, type Ratings } from './score';

export interface Entry {
  id: string;
  city: string;
  /** State, region or country. Named `state` for compatibility with older exports. */
  state: string;
  /** Month of visit, "YYYY-MM". */
  date: string;
  /** Weighted score 0–100, derived from `ratings`. */
  score: number;
  ratings: Ratings;
  notes: string;
  /** ISO timestamp of the last save. */
  savedAt: string;
}

export type SortMode = 'date' | 'score' | 'city';

export function newEntryId(): string {
  return crypto.randomUUID();
}

function clampRating(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return RATING_DEFAULT;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, n));
}

/**
 * Validates untrusted data (an import, a row from an older schema) and
 * returns a well-formed Entry, or null if it can't be salvaged.
 * The score is always recomputed so it can never drift from the ratings.
 */
export function normalizeEntry(raw: unknown): Entry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const city = typeof r.city === 'string' ? r.city.trim() : '';
  const state = typeof r.state === 'string' ? r.state.trim() : '';
  const date = normalizeMonth(typeof r.date === 'string' ? r.date : null);
  if (!city || !state || !date) return null;

  const rawRatings =
    r.ratings && typeof r.ratings === 'object' ? (r.ratings as Record<string, unknown>) : {};
  const ratings: Ratings = {};
  for (const m of METRICS) ratings[m.id] = clampRating(rawRatings[m.id] ?? RATING_DEFAULT);

  const savedAt =
    typeof r.savedAt === 'string' && !Number.isNaN(Date.parse(r.savedAt))
      ? r.savedAt
      : new Date().toISOString();

  return {
    id: typeof r.id === 'string' && r.id ? r.id : newEntryId(),
    city,
    state,
    date,
    score: calcScore(ratings),
    ratings,
    notes: typeof r.notes === 'string' ? r.notes : '',
    savedAt,
  };
}

/** Same city, region and month — re-saving a trip should update, not duplicate. */
export function isSameVisit(a: Pick<Entry, 'city' | 'state' | 'date'>, b: Pick<Entry, 'city' | 'state' | 'date'>): boolean {
  return (
    a.city.toLowerCase() === b.city.toLowerCase() &&
    a.state.toLowerCase() === b.state.toLowerCase() &&
    a.date === b.date
  );
}

export function filterEntries(entries: readonly Entry[], query: string): Entry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...entries];
  return entries.filter(
    (e) =>
      e.city.toLowerCase().includes(q) ||
      e.state.toLowerCase().includes(q) ||
      e.notes.toLowerCase().includes(q),
  );
}

export function sortEntries(entries: readonly Entry[], mode: SortMode): Entry[] {
  const sorted = [...entries];
  switch (mode) {
    case 'date':
      // "YYYY-MM" sorts lexicographically; newest first.
      return sorted.sort((a, b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt));
    case 'score':
      return sorted.sort((a, b) => b.score - a.score);
    case 'city':
      return sorted.sort((a, b) => a.city.localeCompare(b.city, undefined, { sensitivity: 'base' }));
  }
}

export interface MergeResult {
  /** Entries to write: new ones and ones that replace an older local copy. */
  toSave: Entry[];
  added: number;
  updated: number;
  unchanged: number;
}

/**
 * Plans an import. An imported entry matches an existing one by id or,
 * failing that, by visit (city, region, month). The most recently saved
 * copy wins, so importing an old backup never clobbers newer edits.
 */
export function mergeImported(existing: readonly Entry[], imported: readonly Entry[]): MergeResult {
  const current = [...existing];
  const result: MergeResult = { toSave: [], added: 0, updated: 0, unchanged: 0 };

  for (const incoming of imported) {
    const idx = current.findIndex((e) => e.id === incoming.id || isSameVisit(e, incoming));
    const match = idx >= 0 ? current[idx] : undefined;

    if (!match) {
      current.push(incoming);
      result.toSave.push(incoming);
      result.added++;
    } else if (Date.parse(incoming.savedAt) > Date.parse(match.savedAt)) {
      const replacement = { ...incoming, id: match.id };
      current[idx] = replacement;
      result.toSave.push(replacement);
      result.updated++;
    } else {
      result.unchanged++;
    }
  }

  return result;
}
