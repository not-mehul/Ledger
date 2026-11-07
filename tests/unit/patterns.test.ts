import { describe, expect, it } from 'vitest';
import { ratingHabits, scoreTimeline, tierSpread } from '../../src/domain/insights';
import { config, makeEntry, ratingsOf } from './fixtures';

describe('tierSpread', () => {
  it('counts rated entries per tier, best first', () => {
    const entries = [makeEntry({ ratings: ratingsOf(9) }), makeEntry({ ratings: ratingsOf(9) }), makeEntry({ ratings: ratingsOf(2) }), makeEntry({ ratings: {} })];
    expect(tierSpread(entries, config)).toEqual([
      { id: 'exceptional', count: 2 },
      { id: 'strong', count: 0 },
      { id: 'decent', count: 0 },
      { id: 'mixed', count: 0 },
      { id: 'challenging', count: 1 },
    ]);
  });
});

describe('ratingHabits', () => {
  it('needs a few entries', () => {
    expect(ratingHabits([makeEntry(), makeEntry()], config)).toBeNull();
  });

  it('finds the most generous and the harshest metric', () => {
    const r = { ...ratingsOf(6), foodQuality: 9, internet: 2 };
    const h = ratingHabits([makeEntry({ ratings: r }), makeEntry({ ratings: r }), makeEntry({ ratings: { ...r, internet: 5 } })], config)!;
    expect(h.generous.metric.id).toBe('foodQuality');
    expect(h.harsh.metric.id).toBe('internet');
    expect(h.harsh.average).toBe(3);
  });

  it('says nothing when every metric averages the same', () => {
    const e = makeEntry();
    expect(ratingHabits([e, e, e], config)).toBeNull();
  });
});

describe('scoreTimeline', () => {
  it('orders rated entries by visit and keeps a running average', () => {
    const points = scoreTimeline(
      [
        makeEntry({ id: 'late', date: '2025-01', ratings: ratingsOf(8) }),
        makeEntry({ id: 'early', date: '2024-01', ratings: ratingsOf(6) }),
        makeEntry({ id: 'none', date: '2024-06', ratings: {} }),
      ],
      config,
    );
    expect(points.map((p) => p.entry.id)).toEqual(['early', 'late']);
    expect(points.map((p) => p.running)).toEqual([60, 70]);
  });
});
