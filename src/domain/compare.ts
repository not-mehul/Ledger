// ============================================================
// Side-by-side comparison of two or three entries: every active
// metric, each category's average and the overall score, with the
// leader of each row marked. Pure.
// ============================================================

import type { Entry } from './entry';
import { activeCategories, metricsIn, type Category, type Metric, type MetricConfig } from './metrics';
import { calcScore } from './score';
import { categoryAverage } from './insights';

export const COMPARE_MAX = 3;

export interface CompareRow {
  metric: Metric;
  /** One per compared entry, in order; null when that entry didn't rate it. */
  values: (number | null)[];
  /** Indexes of the entries with the highest value. Empty when all are equal or fewer than two rated it. */
  leaders: number[];
}

export interface CompareGroup {
  category: Category;
  averages: (number | null)[];
  leaders: number[];
  rows: CompareRow[];
}

export interface Comparison {
  scores: (number | null)[];
  scoreLeaders: number[];
  groups: CompareGroup[];
  /** Metrics each entry leads outright (no tie). */
  wins: number[];
}

/** Indexes holding the maximum, or [] when it isn't a contest. */
export function leadersOf(values: readonly (number | null)[]): number[] {
  const rated = values.filter((v): v is number => v !== null);
  if (rated.length < 2) return [];
  const max = Math.max(...rated);
  if (rated.every((v) => v === max)) return [];
  return values.flatMap((v, i) => (v === max ? [i] : []));
}

export function compare(entries: readonly Entry[], config: MetricConfig): Comparison {
  const scores = entries.map((e) => calcScore(e.ratings, config));
  const wins = entries.map(() => 0);
  const groups: CompareGroup[] = [];

  for (const category of activeCategories(config)) {
    const rows = metricsIn(config, category.id)
      .map((metric): CompareRow => {
        const values = entries.map((e) => e.ratings[metric.id] ?? null);
        return { metric, values, leaders: leadersOf(values) };
      })
      .filter((r) => r.values.some((v) => v !== null));
    if (!rows.length) continue;
    for (const r of rows) if (r.leaders.length === 1) wins[r.leaders[0]!]!++;
    const averages = entries.map((e) => categoryAverage(e, config, category.id));
    groups.push({ category, averages, leaders: leadersOf(averages), rows });
  }

  return { scores, scoreLeaders: leadersOf(scores), groups, wins };
}
