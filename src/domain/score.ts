import { METRICS, RATING_DEFAULT, RATING_MAX } from './metrics';

export type Ratings = Record<string, number>;

const TOTAL_WEIGHT = METRICS.reduce((sum, m) => sum + m.weight, 0);

/** Weighted score on a 0–100 scale, rounded to one decimal place. */
export function calcScore(ratings: Ratings): number {
  const weighted = METRICS.reduce(
    (sum, m) => sum + (ratings[m.id] ?? RATING_DEFAULT) * m.weight,
    0,
  );
  return Math.round((weighted / (TOTAL_WEIGHT * RATING_MAX)) * 1000) / 10;
}

export interface ScoreTier {
  color: string;
  description: string;
  /** Traffic-light marker used in the Markdown export. */
  marker: string;
}

const TIERS: readonly (ScoreTier & { min: number })[] = [
  { min: 85, color: '#9fb3a0', marker: '🟢', description: 'Exceptional — a serious contender.' },
  { min: 72, color: '#b8c9a0', marker: '🟢', description: 'Strong — worth keeping an eye on.' },
  { min: 58, color: '#d4a574', marker: '🟡', description: 'Decent — has its merits.' },
  { min: 42, color: '#c08050', marker: '🟠', description: 'Mixed — notable drawbacks.' },
  { min: -Infinity, color: '#f87171', marker: '🔴', description: 'Challenging — may not suit you.' },
];

/** One shared tiering so the form, the cards and the export always agree. */
export function scoreTier(score: number): ScoreTier {
  const { color, description, marker } = TIERS.find((t) => score >= t.min)!;
  return { color, description, marker };
}

/** Colour for a single 1–10 rating (slider fill, value label). */
export function ratingColor(value: number): string {
  if (value <= 3) return '#f87171';
  if (value >= 8) return '#9fb3a0';
  return '#d4a574';
}
