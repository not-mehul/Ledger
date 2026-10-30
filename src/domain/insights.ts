// ============================================================
// Insights: year in review, per-category rankings, and "what you
// actually value" (how each metric tracks an overall verdict such as
// Return Desire). Pure functions over entries + metric config.
// ============================================================

import type { Entry } from './entry';
import {
  WEIGHT_MAX,
  WEIGHT_MIN,
  activeCategories,
  activeMetrics,
  clampWeight,
  metricsIn,
  type Category,
  type Metric,
  type MetricConfig,
} from './metrics';
import { calcScore } from './score';

// ---------- shared helpers ----------

export function yearOf(entry: Entry): number {
  return Number(entry.date.slice(0, 4));
}

/** Years that have entries, newest first. */
export function yearsOf(entries: readonly Entry[]): number[] {
  return [...new Set(entries.map(yearOf))].sort((a, b) => b - a);
}

/** Entries in `year`, or all entries when `year` is null. */
export function inYear(entries: readonly Entry[], year: number | null): Entry[] {
  return year === null ? [...entries] : entries.filter((e) => yearOf(e) === year);
}

/** Average of the entry's ratings within a category, or null if none are rated. */
export function categoryAverage(entry: Entry, config: MetricConfig, catId: string): number | null {
  const values = metricsIn(config, catId)
    .map((m) => entry.ratings[m.id])
    .filter((v): v is number => typeof v === 'number');
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

type Located = Entry & { lat: number; lon: number };
const isLocated = (e: Entry): e is Located => e.lat !== undefined && e.lon !== undefined;

// ---------- rankings ----------

export type RankKey = { kind: 'score' } | { kind: 'category'; id: string } | { kind: 'metric'; id: string };

export interface Ranked {
  entry: Entry;
  /** 0–100 for the overall score, 1–10 for categories and metrics. */
  value: number;
}

/** Entries ordered best-first by the chosen measure; unrated entries are left out. */
export function rank(entries: readonly Entry[], config: MetricConfig, key: RankKey): Ranked[] {
  const valueOf = (e: Entry): number | null => {
    switch (key.kind) {
      case 'score':
        return calcScore(e.ratings, config);
      case 'category':
        return categoryAverage(e, config, key.id);
      case 'metric':
        return e.ratings[key.id] ?? null;
    }
  };
  return entries
    .map((entry) => ({ entry, value: valueOf(entry) }))
    .filter((r): r is Ranked => r.value !== null)
    .sort(
      (a, b) =>
        b.value - a.value ||
        (calcScore(b.entry.ratings, config) ?? 0) - (calcScore(a.entry.ratings, config) ?? 0) ||
        a.entry.city.localeCompare(b.entry.city),
    );
}

// ---------- year in review ----------

export interface CategoryWinner {
  category: Category;
  entry: Entry;
  average: number;
}

export interface YearReview {
  year: number | null;
  cities: number;
  /** ISO country codes, for entries placed via the city list. */
  countries: string[];
  /** Distinct months with at least one visit. */
  months: number;
  photos: number;
  averageScore: number | null;
  best: Ranked | null;
  worst: Ranked | null;
  /** Great-circle distance between consecutive visits, in visit order. */
  distanceKm: number;
  /** Best city in each category (ties go to the higher overall score). */
  winners: CategoryWinner[];
  first: Entry | null;
  latest: Entry | null;
}

export function yearReview(all: readonly Entry[], config: MetricConfig, year: number | null): YearReview {
  const entries = inYear(all, year);
  const byScore = rank(entries, config, { kind: 'score' });
  const chronological = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.savedAt.localeCompare(b.savedAt));

  let distanceKm = 0;
  const located = chronological.filter(isLocated);
  for (let i = 1; i < located.length; i++) distanceKm += haversineKm(located[i - 1]!, located[i]!);

  const winners: CategoryWinner[] = [];
  for (const category of activeCategories(config)) {
    const top = rank(entries, config, { kind: 'category', id: category.id })[0];
    if (top) winners.push({ category, entry: top.entry, average: top.value });
  }

  const scores = byScore.map((r) => r.value);
  return {
    year,
    cities: new Set(entries.map((e) => `${e.city.toLowerCase()}|${e.state.toLowerCase()}`)).size,
    countries: [...new Set(entries.map((e) => e.country).filter((c): c is string => !!c))].sort(),
    months: new Set(entries.map((e) => e.date)).size,
    photos: entries.reduce((n, e) => n + e.photos.length, 0),
    averageScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    best: byScore[0] ?? null,
    worst: byScore.length > 1 ? byScore[byScore.length - 1]! : null,
    distanceKm: Math.round(distanceKm),
    winners,
    first: chronological[0] ?? null,
    latest: chronological[chronological.length - 1] ?? null,
  };
}

// ---------- what you actually value ----------

/** Fewest entries rating both metrics before a correlation is reported. */
export const MIN_SAMPLES = 5;

export interface MetricSignal {
  metric: Metric;
  /** Pearson correlation with the target, or null when it can't be computed. */
  r: number | null;
  /** Entries that rated both this metric and the target. */
  n: number;
  /** Weight implied by the correlation, on the app's weight scale; null if no signal. */
  suggested: number | null;
}

export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null; // no variation, no signal
  return sxy / Math.sqrt(sxx * syy);
}

/** The metric to explain: Return Desire if it's active, else the first metric in the last category. */
export function defaultTarget(config: MetricConfig): Metric | undefined {
  const active = activeMetrics(config);
  return active.find((m) => m.id === 'returnDesire') ?? active[active.length - 1];
}

/**
 * How closely each other active metric moves with `targetId` across your
 * entries, and a weight that reflects it. Suggested weights scale the
 * positive correlations so the strongest signal gets the maximum weight,
 * snapped to the app's weight steps; metrics with no positive relationship
 * get the minimum. Signals need at least MIN_SAMPLES entries.
 */
export function valueSignals(entries: readonly Entry[], config: MetricConfig, targetId: string): MetricSignal[] {
  const signals = activeMetrics(config)
    .filter((m) => m.id !== targetId)
    .map((metric) => {
      const pairs = entries
        .map((e) => [e.ratings[metric.id], e.ratings[targetId]] as const)
        .filter((p): p is readonly [number, number] => typeof p[0] === 'number' && typeof p[1] === 'number');
      const r = pairs.length >= MIN_SAMPLES ? pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1])) : null;
      return { metric, r, n: pairs.length };
    });

  const strongest = Math.max(0, ...signals.map((s) => s.r ?? 0));
  return signals
    .map((s) => ({
      ...s,
      suggested:
        s.r === null || strongest === 0
          ? null
          : clampWeight(WEIGHT_MIN + (Math.max(0, s.r) / strongest) * (WEIGHT_MAX - WEIGHT_MIN)),
    }))
    .sort((a, b) => (b.r ?? -2) - (a.r ?? -2));
}

/** Applies suggested weights; metrics without a suggestion keep their weight. */
export function applySuggestedWeights(config: MetricConfig, signals: readonly MetricSignal[]): MetricConfig {
  const next = new Map(signals.filter((s) => s.suggested !== null).map((s) => [s.metric.id, s.suggested!]));
  return {
    ...config,
    metrics: config.metrics.map((m) => (next.has(m.id) ? { ...m, weight: next.get(m.id)! } : m)),
  };
}
