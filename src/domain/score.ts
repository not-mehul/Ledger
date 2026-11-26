import { RATING_MAX, RATING_MIN, activeMetrics, type MetricConfig } from './metrics';

export type Ratings = Record<string, number>;

/**
 * Weighted score on a 0–100 scale, rounded to one decimal place: every
 * rating at the bottom of its slider scores 0, every one at the top 100.
 * Only active metrics the entry actually rated count, so adding a metric
 * later, or skipping one, doesn't drag the score down.
 * Returns null when nothing counts.
 */
export function calcScore(ratings: Ratings, config: MetricConfig): number | null {
  let weighted = 0;
  let total = 0;
  for (const m of activeMetrics(config)) {
    const r = ratings[m.id];
    if (typeof r !== 'number') continue;
    weighted += ((r - RATING_MIN) / (RATING_MAX - RATING_MIN)) * m.weight;
    total += m.weight;
  }
  if (!total) return null;
  return Math.round((weighted / total) * 1000) / 10;
}

export type TierId = 'exceptional' | 'strong' | 'decent' | 'mixed' | 'challenging';

export interface ScoreTier {
  id: TierId;
  /** CSS custom property holding the tier colour (theme-aware). */
  cssVar: string;
}

/**
 * Where each tier starts. Before 2.1 a score ran from 10 (every rating at 1)
 * to 100, and the tiers began at 85, 72, 58 and 42. Scores now run from 0, and
 * these are the same lines on the new scale (to a tenth of a point), so every
 * city keeps its tier.
 */
const onNewScale = (old: number) => Math.round(((old - 10) / 0.9) * 10) / 10;
export const TIER_LINES = { exceptional: onNewScale(85), strong: onNewScale(72), decent: onNewScale(58), mixed: onNewScale(42) } as const;

const TIERS: readonly (ScoreTier & { min: number })[] = [
  { min: TIER_LINES.exceptional, id: 'exceptional', cssVar: '--scale-1' },
  { min: TIER_LINES.strong, id: 'strong', cssVar: '--scale-2' },
  { min: TIER_LINES.decent, id: 'decent', cssVar: '--scale-3' },
  { min: TIER_LINES.mixed, id: 'mixed', cssVar: '--scale-4' },
  { min: -Infinity, id: 'challenging', cssVar: '--scale-5' },
];

/** One shared tiering so the form, cards, map and exports always agree. */
export function scoreTier(score: number): ScoreTier {
  const { id, cssVar } = TIERS.find((t) => score >= t.min)!;
  return { id, cssVar };
}

export type RatingLevel = 'low' | 'mid' | 'high';

export function ratingLevel(value: number): RatingLevel {
  if (value <= 3) return 'low';
  if (value >= 8) return 'high';
  return 'mid';
}
