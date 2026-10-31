import { RATING_MAX, activeMetrics, type MetricConfig } from './metrics';

export type Ratings = Record<string, number>;

/**
 * Weighted score on a 0–100 scale, rounded to one decimal place.
 * Only active metrics the entry actually rated count, so adding a metric
 * later doesn't drag down entries logged before it existed.
 * Returns null when nothing counts.
 */
export function calcScore(ratings: Ratings, config: MetricConfig): number | null {
  let weighted = 0;
  let total = 0;
  for (const m of activeMetrics(config)) {
    const r = ratings[m.id];
    if (typeof r !== 'number') continue;
    weighted += r * m.weight;
    total += m.weight;
  }
  if (!total) return null;
  return Math.round((weighted / (total * RATING_MAX)) * 1000) / 10;
}

export type TierId = 'exceptional' | 'strong' | 'decent' | 'mixed' | 'challenging';

export interface ScoreTier {
  id: TierId;
  /** CSS custom property holding the tier colour (theme-aware). */
  cssVar: string;
  /** Fixed colour for theme-independent output (share cards). */
  color: string;
  /** Traffic-light marker used in Markdown export. */
  marker: string;
}

const TIERS: readonly (ScoreTier & { min: number })[] = [
  { min: 85, id: 'exceptional', cssVar: '--scale-1', color: '#9fb3a0', marker: '🟢' },
  { min: 72, id: 'strong', cssVar: '--scale-2', color: '#b8c9a0', marker: '🟢' },
  { min: 58, id: 'decent', cssVar: '--scale-3', color: '#d4a574', marker: '🟡' },
  { min: 42, id: 'mixed', cssVar: '--scale-4', color: '#c08050', marker: '🟠' },
  { min: -Infinity, id: 'challenging', cssVar: '--scale-5', color: '#f87171', marker: '🔴' },
];

/** One shared tiering so the form, cards, map and exports always agree. */
export function scoreTier(score: number): ScoreTier {
  const { id, cssVar, color, marker } = TIERS.find((t) => score >= t.min)!;
  return { id, cssVar, color, marker };
}

export type RatingLevel = 'low' | 'mid' | 'high';

export function ratingLevel(value: number): RatingLevel {
  if (value <= 3) return 'low';
  if (value >= 8) return 'high';
  return 'mid';
}
