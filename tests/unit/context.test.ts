import { describe, expect, it } from 'vitest';
import { metricAverages, placing, previousVisit, samePlace, scoreChange, standouts, thisMonthBefore, visitsTo } from '../../src/domain/context';
import { config, makeEntry, ratingsOf } from './fixtures';

describe('visits', () => {
  const a = makeEntry({ id: 'a', date: '2023-05' });
  const b = makeEntry({ id: 'b', date: '2025-02', city: ' austin ', state: 'TEXAS' });
  const other = makeEntry({ id: 'c', city: 'Lisbon', state: 'Portugal', date: '2024-01' });

  it('matches a place whatever the case, spacing or month', () => {
    expect(samePlace(a, b)).toBe(true);
    expect(samePlace(a, other)).toBe(false);
  });

  it('lists visits oldest first', () => {
    expect(visitsTo([b, other, a], a).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('finds the latest visit before a month', () => {
    expect(previousVisit([a, b], a, '2025-02')?.id).toBe('a');
    expect(previousVisit([a, b], a, '2023-05')).toBeUndefined();
    expect(previousVisit([a, b], a)?.id).toBe('b');
  });

  it('measures the score change between visits', () => {
    const better = makeEntry({ ratings: ratingsOf(8) });
    expect(scoreChange(a, better, config)).toBe(10);
    expect(scoreChange(a, makeEntry({ ratings: {} }), config)).toBeNull();
  });
});

describe('placing', () => {
  const scores: [string, number | null][] = [['x', 90], ['y', 70], ['z', null], ['w', 70]];

  it('counts entries scoring higher, sharing ties', () => {
    expect(placing(80, scores)).toEqual({ position: 2, of: 4 });
    expect(placing(70, scores)).toEqual({ position: 2, of: 4 });
    expect(placing(95, scores)).toEqual({ position: 1, of: 4 });
  });

  it('leaves out the entry being edited', () => {
    expect(placing(80, scores, 'x')).toEqual({ position: 1, of: 3 });
  });
});

describe('standouts', () => {
  const plain = makeEntry({ ratings: ratingsOf(5) });

  it('compares each rating with your usual one', () => {
    const entry = makeEntry({ id: 'n', ratings: { ...ratingsOf(5), foodQuality: 9, safety: 2 } });
    const avg = metricAverages([plain, makeEntry({ ratings: { ...ratingsOf(5), foodQuality: 10 } })], config);
    const s = standouts(entry, config, avg, 2)!;
    // Food is 9 against an average of 7.5 (+1.5); safety 2 against 5 (−3).
    expect(s.best.metric.id).toBe('foodQuality');
    expect(s.best.delta).toBe(1.5);
    expect(s.worst.metric.id).toBe('safety');
    expect(s.worst.delta).toBe(-3);
  });

  it('falls back to raw ratings with nothing to compare', () => {
    const entry = makeEntry({ ratings: { ...ratingsOf(5), internet: 9, greenery: 1 } });
    const s = standouts(entry, config, new Map(), 0)!;
    expect(s.best.metric.id).toBe('internet');
    expect(s.best.delta).toBeNull();
    expect(s.worst.metric.id).toBe('greenery');
  });

  it('says nothing when every rating is the same', () => {
    expect(standouts(plain, config, new Map(), 0)).toBeNull();
    expect(standouts(makeEntry({ ratings: { safety: 4 } }), config, new Map(), 0)).toBeNull();
  });
});

describe('thisMonthBefore', () => {
  it('finds visits in this calendar month of earlier years, newest first', () => {
    const entries = [
      makeEntry({ id: 'old', date: '2022-11' }),
      makeEntry({ id: 'recent', date: '2025-11' }),
      makeEntry({ id: 'now', date: '2026-11' }),
      makeEntry({ id: 'other', date: '2025-10' }),
    ];
    expect(thisMonthBefore(entries, new Date(2026, 10, 5)).map((e) => e.id)).toEqual(['recent', 'old']);
  });
});
