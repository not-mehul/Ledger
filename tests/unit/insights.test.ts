import { describe, expect, it } from 'vitest';
import {
  MIN_SAMPLES,
  applySuggestedWeights,
  categoryAverage,
  defaultTarget,
  haversineKm,
  inYear,
  pearson,
  rank,
  valueSignals,
  yearReview,
  yearsOf,
} from '../../src/domain/insights';
import { updateMetric } from '../../src/domain/metrics';
import { config, makeEntry, ratingsOf } from './fixtures';

const austin = makeEntry({ id: 'a', city: 'Austin', state: 'Texas', country: 'US', lat: 30.27, lon: -97.74, date: '2025-03', ratings: { ...ratingsOf(6), foodQuality: 10 } });
const lisbon = makeEntry({ id: 'l', city: 'Lisbon', state: 'Portugal', country: 'PT', lat: 38.72, lon: -9.14, date: '2025-06', ratings: { ...ratingsOf(8), safety: 10 }, photos: [{ id: 'p', width: 1, height: 1 }] });
const kyoto = makeEntry({ id: 'k', city: 'Kyoto', state: 'Japan', country: 'JP', lat: 35.01, lon: 135.77, date: '2024-11', ratings: ratingsOf(9) });
const typed = makeEntry({ id: 't', city: 'Nowhere', state: 'Atlantis', date: '2025-06', ratings: { greenery: 2 } });

describe('basics', () => {
  it('groups by year', () => {
    expect(yearsOf([austin, kyoto, lisbon])).toEqual([2025, 2024]);
    expect(inYear([austin, kyoto], 2024).map((e) => e.id)).toEqual(['k']);
    expect(inYear([austin, kyoto], null)).toHaveLength(2);
  });

  it('averages a category over rated metrics only', () => {
    expect(categoryAverage(austin, config, 'food')).toBe(8); // (10 + 6) / 2
    expect(categoryAverage(typed, config, 'food')).toBeNull();
  });

  it('measures great-circle distance', () => {
    expect(haversineKm({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 })).toBeCloseTo(344, -1);
  });
});

describe('rank', () => {
  it('ranks by score, category or metric and drops unrated entries', () => {
    const all = [austin, lisbon, kyoto, typed];
    expect(rank(all, config, { kind: 'score' }).map((r) => r.entry.id)).toEqual(['k', 'l', 'a', 't']);
    // Austin and Lisbon both average 8 for food; the tie goes to the higher overall score.
    expect(rank(all, config, { kind: 'category', id: 'food' }).map((r) => r.entry.id)).toEqual(['k', 'l', 'a']);
    expect(rank(all, config, { kind: 'metric', id: 'safety' })[0]).toMatchObject({ value: 10, entry: { id: 'l' } });
  });
});

describe('yearReview', () => {
  it('summarises a year', () => {
    const r = yearReview([austin, lisbon, kyoto, typed], config, 2025);
    expect(r).toMatchObject({ year: 2025, cities: 3, countries: ['PT', 'US'], months: 2, photos: 1 });
    expect(r.best?.entry.id).toBe('l');
    expect(r.worst?.entry.id).toBe('t');
    expect(r.first?.id).toBe('a');
    expect(r.distanceKm).toBeGreaterThan(7000); // Austin → Lisbon
    expect(r.distanceKm).toBeLessThan(8500);
    expect(r.winners.find((w) => w.category.id === 'people')?.entry.id).toBe('l');
  });

  it('covers all time and handles an empty year', () => {
    expect(yearReview([austin, kyoto], config, null).cities).toBe(2);
    const empty = yearReview([austin], config, 1999);
    expect(empty).toMatchObject({ cities: 0, best: null, worst: null, averageScore: null, distanceKm: 0, winners: [] });
  });
});

describe('what you value', () => {
  it('computes Pearson correlation and refuses constant series', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
    expect(pearson([5, 5, 5], [1, 2, 3])).toBeNull();
  });

  it('defaults to Return Desire, else the last active metric', () => {
    expect(defaultTarget(config)?.id).toBe('returnDesire');
    expect(defaultTarget(updateMetric(config, 'returnDesire', { archived: true }))?.id).toBe('internet');
  });

  // Return desire follows food closely, ignores internet, and is opposed by cleanliness.
  const entries = Array.from({ length: 8 }, (_, i) =>
    makeEntry({
      id: `e${i}`,
      city: `City ${i}`,
      ratings: {
        ...ratingsOf(5),
        foodQuality: 2 + i,
        returnDesire: 2 + i,
        internet: i % 2 ? 9 : 3,
        cleanliness: 9 - i,
      },
    }),
  );

  it('finds the metrics that track the target', () => {
    const signals = valueSignals(entries, config, 'returnDesire');
    expect(signals[0]).toMatchObject({ metric: { id: 'foodQuality' }, n: 8, suggested: 5 });
    expect(signals[0]!.r).toBeCloseTo(1);
    const internet = signals.find((s) => s.metric.id === 'internet')!;
    expect(Math.abs(internet.r!)).toBeLessThan(0.3);
    expect(signals.find((s) => s.metric.id === 'cleanliness')).toMatchObject({ suggested: 0.5 });
    // Constant metrics carry no signal.
    expect(signals.find((s) => s.metric.id === 'safety')).toMatchObject({ r: null, suggested: null });
    expect(signals.some((s) => s.metric.id === 'returnDesire')).toBe(false);
  });

  it('needs enough entries', () => {
    const few = valueSignals(entries.slice(0, MIN_SAMPLES - 1), config, 'returnDesire');
    expect(few.every((s) => s.r === null && s.suggested === null)).toBe(true);
  });

  it('applies suggested weights and leaves the rest alone', () => {
    const next = applySuggestedWeights(config, valueSignals(entries, config, 'returnDesire'));
    const w = (id: string) => next.metrics.find((m) => m.id === id)!.weight;
    expect(w('foodQuality')).toBe(5);
    expect(w('cleanliness')).toBe(0.5);
    expect(w('safety')).toBe(2); // unchanged: no signal
    expect(w('returnDesire')).toBe(2); // the target itself is untouched
  });
});
