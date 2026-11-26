import { normalizeMonth } from '../lib/dates';
import { RATING_MAX, RATING_MIN } from './metrics';
import { scoreTier, type Ratings, type TierId } from './score';

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
  /** ISO timestamp of the last save. */
  savedAt: string;
}

export type SortMode = 'date' | 'score' | 'city';

export function newEntryId(): string {
  return crypto.randomUUID();
}

/** A rating from untrusted data: a number or a numeric string. Anything else (null, "", true) is unrated. */
function clampRating(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  const n = Math.round(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, n));
}

/** How far ahead of this phone's clock a saved time may be before it's treated as wrong. */
const CLOCK_SLACK_MS = 86_400_000;

/**
 * A `savedAt` from untrusted data. Missing, unreadable or far-future times
 * (a phone with its clock set ahead) become now, so they can't outrank every
 * later edit in "most recently saved wins".
 */
function savedTime(value: unknown, now: number): string {
  const t = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(t) || t > now + CLOCK_SLACK_MS ? new Date(now).toISOString() : (value as string);
}

/** The `savedAt` for a save now: always later than the copy it replaces, so the edit wins. */
export function nextSavedAt(previous?: string, now = Date.now()): string {
  const before = previous ? Date.parse(previous) : NaN;
  return new Date(Number.isNaN(before) ? now : Math.max(now, before + 1)).toISOString();
}

function coord(value: unknown, limit: number): number | undefined {
  const n = Number(value);
  return typeof value === 'number' && Number.isFinite(n) && Math.abs(n) <= limit ? n : undefined;
}

/**
 * Validates untrusted data (an import, an older schema) and returns a
 * well-formed Entry, or null if it can't be salvaged. Any `score` in the
 * input is ignored: scores are always derived from ratings and the
 * current metric configuration. Photos, which older versions kept, are
 * dropped.
 */
export function normalizeEntry(raw: unknown, now = Date.now()): Entry | null {
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

  const savedAt = savedTime(r.savedAt, now);

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

/**
 * Entries whose city, region or notes hold the query, or whose country's name
 * does: US, Canadian and Australian entries store the state, so "United
 * States" would otherwise find none of them. `countryNames` gives the names to
 * match for a country code (the reader's language and English, say).
 */
export function filterEntries(
  entries: readonly Entry[],
  query: string,
  countryNames: (code: string) => readonly string[] = () => [],
): Entry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...entries];
  return entries.filter(
    (e) =>
      e.city.toLowerCase().includes(q) ||
      e.state.toLowerCase().includes(q) ||
      e.notes.toLowerCase().includes(q) ||
      (!!e.country && countryNames(e.country).some((n) => n.toLowerCase().includes(q))),
  );
}

/** Narrowing the ledger to one country, year or tier. An empty field lets everything through. */
export interface EntryFilter {
  /** ISO 3166-1 alpha-2. */
  country?: string;
  /** "YYYY". */
  year?: string;
  tier?: TierId;
}

export function isFiltering(f: EntryFilter): boolean {
  return !!(f.country || f.year || f.tier);
}

export function applyFilter(
  entries: readonly Entry[],
  f: EntryFilter,
  scoreOf: (e: Entry) => number | null = () => null,
): Entry[] {
  if (!isFiltering(f)) return [...entries];
  return entries.filter((e) => {
    if (f.country && e.country !== f.country) return false;
    if (f.year && !e.date.startsWith(`${f.year}-`)) return false;
    if (f.tier) {
      const s = scoreOf(e);
      if (s === null || scoreTier(s).id !== f.tier) return false;
    }
    return true;
  });
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
    // An id match wins over a visit match anywhere else in the list.
    let idx = current.findIndex((e) => e.id === incoming.id);
    if (idx < 0) idx = current.findIndex((e) => isSameVisit(e, incoming));
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
