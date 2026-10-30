import { normalizeMonth } from '../lib/dates';
import { RATING_MAX, RATING_MIN } from './metrics';
import type { Ratings } from './score';

export interface Photo {
  /** File id; see src/data/photo-store.ts. */
  id: string;
  width: number;
  height: number;
}

export interface Entry {
  id: string;
  city: string;
  /** State, region or country as typed. Named `state` for compatibility with older exports. */
  state: string;
  /** ISO 3166-1 alpha-2 country code, when known. */
  country?: string;
  lat?: number;
  lon?: number;
  /** Month of visit, "YYYY-MM". */
  date: string;
  /** Ratings keyed by metric id. Unrated metrics are absent. */
  ratings: Ratings;
  notes: string;
  photos: Photo[];
  /** ISO timestamp of the last save. */
  savedAt: string;
}

export type SortMode = 'date' | 'score' | 'city';

export function newEntryId(): string {
  return crypto.randomUUID();
}

function clampRating(value: unknown): number | null {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, n));
}

function coord(value: unknown, limit: number): number | undefined {
  const n = Number(value);
  return typeof value === 'number' && Number.isFinite(n) && Math.abs(n) <= limit ? n : undefined;
}

function normalizePhotos(raw: unknown): Photo[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p: Record<string, unknown>) =>
    p && typeof p.id === 'string' && /^[\w-]+$/.test(p.id)
      ? [{ id: p.id, width: Number(p.width) || 0, height: Number(p.height) || 0 }]
      : [],
  );
}

/**
 * Validates untrusted data (an import, an older schema) and returns a
 * well-formed Entry, or null if it can't be salvaged. Any `score` in the
 * input is ignored: scores are always derived from ratings and the
 * current metric configuration.
 */
export function normalizeEntry(raw: unknown): Entry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const city = typeof r.city === 'string' ? r.city.trim() : '';
  const state = typeof r.state === 'string' ? r.state.trim() : '';
  const date = normalizeMonth(typeof r.date === 'string' ? r.date : null);
  if (!city || !state || !date) return null;

  const ratings: Ratings = {};
  if (r.ratings && typeof r.ratings === 'object') {
    for (const [id, value] of Object.entries(r.ratings as Record<string, unknown>)) {
      const n = clampRating(value);
      if (n !== null) ratings[id] = n;
    }
  }

  const savedAt =
    typeof r.savedAt === 'string' && !Number.isNaN(Date.parse(r.savedAt))
      ? r.savedAt
      : new Date().toISOString();

  const lat = coord(r.lat, 90);
  const lon = coord(r.lon, 180);
  const hasCoords = lat !== undefined && lon !== undefined;

  return {
    id: typeof r.id === 'string' && r.id ? r.id : newEntryId(),
    city,
    state,
    ...(typeof r.country === 'string' && /^[A-Z]{2}$/.test(r.country) ? { country: r.country } : {}),
    ...(hasCoords ? { lat, lon } : {}),
    date,
    ratings,
    notes: typeof r.notes === 'string' ? r.notes : '',
    photos: normalizePhotos(r.photos),
    savedAt,
  };
}

type Visit = Pick<Entry, 'city' | 'state' | 'date'>;

/** Same city, region and month — re-saving a trip should update, not duplicate. */
export function isSameVisit(a: Visit, b: Visit): boolean {
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

export function sortEntries(
  entries: readonly Entry[],
  mode: SortMode,
  scoreOf: (e: Entry) => number | null = () => null,
): Entry[] {
  const sorted = [...entries];
  switch (mode) {
    case 'date':
      // "YYYY-MM" sorts lexicographically; newest first.
      return sorted.sort((a, b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt));
    case 'score':
      return sorted.sort((a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1));
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

/** Applies a merge plan to a list, replacing by id or appending. */
export function applyUpserts(entries: readonly Entry[], upserts: readonly Entry[]): Entry[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  for (const e of upserts) byId.set(e.id, e);
  return [...byId.values()];
}
