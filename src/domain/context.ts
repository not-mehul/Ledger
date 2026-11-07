// ============================================================
// Context for a single entry: how it sits against the rest of the
// ledger. Repeat visits, where it ranks, its strongest and weakest
// metrics, how each rating compares with your usual one, and which
// past visits fell in this month. Pure functions.
// ============================================================

import type { Entry } from './entry';
import { activeMetrics, type Metric, type MetricConfig } from './metrics';
import { calcScore } from './score';

const placeKey = (e: Pick<Entry, 'city' | 'state'>) => `${e.city.trim().toLowerCase()}|${e.state.trim().toLowerCase()}`;

/** True when two entries are the same place, whatever the month. */
export function samePlace(a: Pick<Entry, 'city' | 'state'>, b: Pick<Entry, 'city' | 'state'>): boolean {
  return placeKey(a) === placeKey(b);
}

/** Every visit to the place, oldest first. */
export function visitsTo(entries: readonly Entry[], place: Pick<Entry, 'city' | 'state'>): Entry[] {
  return entries
    .filter((e) => samePlace(e, place))
    .sort((a, b) => a.date.localeCompare(b.date) || a.savedAt.localeCompare(b.savedAt));
}

/** The most recent visit to the place before `date` (any visit when `date` is omitted). */
export function previousVisit(entries: readonly Entry[], place: Pick<Entry, 'city' | 'state'>, date?: string): Entry | undefined {
  const visits = visitsTo(entries, place).filter((e) => (date ? e.date < date : true));
  return visits[visits.length - 1];
}

export interface Placing {
  /** 1-based position among rated entries, best first. */
  position: number;
  /** How many rated entries there are, including this one. */
  of: number;
}

/**
 * Where a score would place among the ledger's scores. Ties share the
 * better position. `excludeId` leaves out the entry being edited so it
 * isn't counted twice.
 */
export function placing(score: number, scores: Iterable<[string, number | null]>, excludeId?: string | null): Placing {
  let better = 0;
  let of = 1;
  for (const [id, s] of scores) {
    if (id === excludeId || s === null) continue;
    of++;
    if (s > score) better++;
  }
  return { position: better + 1, of };
}

/** Your average rating per active metric across entries that rated it. */
export function metricAverages(entries: readonly Entry[], config: MetricConfig): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of activeMetrics(config)) {
    const values = entries.map((e) => e.ratings[m.id]).filter((v): v is number => typeof v === 'number');
    if (values.length) out.set(m.id, values.reduce((a, b) => a + b, 0) / values.length);
  }
  return out;
}

export interface Standout {
  metric: Metric;
  value: number;
  /** Rating minus your usual rating for this metric; null with nothing to compare. */
  delta: number | null;
}

/**
 * The metric where this entry beats your usual rating by the most, and the
 * one where it falls furthest short. With no other entries to compare,
 * falls back to the highest and lowest raw ratings. Null when the entry
 * rated fewer than two metrics or every rating is the same.
 */
export function standouts(
  entry: Entry,
  config: MetricConfig,
  averages: ReadonlyMap<string, number>,
  others: number,
): { best: Standout; worst: Standout } | null {
  const rated = activeMetrics(config)
    .filter((m) => typeof entry.ratings[m.id] === 'number')
    .map((metric) => {
      const value = entry.ratings[metric.id]!;
      const avg = averages.get(metric.id);
      return { metric, value, delta: others > 0 && avg !== undefined ? value - avg : null };
    });
  if (rated.length < 2) return null;
  const key = (s: Standout) => (others > 0 ? (s.delta ?? 0) : s.value);
  const sorted = [...rated].sort((a, b) => key(b) - key(a) || b.metric.weight - a.metric.weight);
  const best = sorted[0]!;
  const worst = sorted[sorted.length - 1]!;
  if (key(best) === key(worst)) return null;
  return { best, worst };
}

/** Score change from `from` to `to`, one decimal. Null if either is unrated. */
export function scoreChange(from: Entry, to: Entry, config: MetricConfig): number | null {
  const a = calcScore(from.ratings, config);
  const b = calcScore(to.ratings, config);
  return a === null || b === null ? null : Math.round((b - a) * 10) / 10;
}

/**
 * Visits from this calendar month in earlier years ("a year ago you were in
 * Lisbon"), most recent first.
 */
export function thisMonthBefore(entries: readonly Entry[], now = new Date()): Entry[] {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return entries
    .filter((e) => e.date.slice(5, 7) === month && Number(e.date.slice(0, 4)) < year)
    .sort((a, b) => b.date.localeCompare(a.date));
}
