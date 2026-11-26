import { describe, expect, it } from 'vitest';
import { updateMetric } from '../../src/domain/metrics';
import { calcScore, ratingLevel, scoreTier } from '../../src/domain/score';
import { config, ratingsOf } from './fixtures';

describe('calcScore', () => {
  it('maps uniform ratings onto 0–100', () => {
    expect(calcScore(ratingsOf(10), config)).toBe(100);
    // 5 is four steps of nine up the slider.
    expect(calcScore(ratingsOf(5), config)).toBe(44.4);
    expect(calcScore(ratingsOf(1), config)).toBe(0);
  });

  it('returns null when nothing is rated', () => {
    expect(calcScore({}, config)).toBeNull();
  });

  it('ignores unrated and unknown metrics instead of assuming a default', () => {
    expect(calcScore({ greenery: 8 }, config)).toBe(77.8);
    expect(calcScore({ greenery: 8, mystery: 1 }, config)).toBe(77.8);
  });

  it('weights heavier metrics more', () => {
    const heavy = calcScore({ ...ratingsOf(5), greenery: 10 }, config); // ×2
    const light = calcScore({ ...ratingsOf(5), temperature: 10 }, config); // ×1
    expect(heavy!).toBeGreaterThan(light!);
  });

  it('follows weight changes and hidden metrics', () => {
    const ratings = { ...ratingsOf(5), safety: 10 };
    const reweighted = updateMetric(config, 'safety', { weight: 5 });
    expect(calcScore(ratings, reweighted)!).toBeGreaterThan(calcScore(ratings, config)!);
    const hidden = updateMetric(config, 'safety', { archived: true });
    expect(calcScore(ratings, hidden)).toBe(44.4);
  });
});

describe('scoreTier / ratingLevel', () => {
  it('picks tiers at their boundaries', () => {
    expect(scoreTier(83.3).id).toBe('exceptional');
    expect(scoreTier(83.2).id).toBe('strong');
    expect(scoreTier(68.9).id).toBe('strong');
    expect(scoreTier(53.3).id).toBe('decent');
    expect(scoreTier(35.6).id).toBe('mixed');
    expect(scoreTier(35.5).id).toBe('challenging');
    expect(scoreTier(0).id).toBe('challenging');
    expect(scoreTier(90).cssVar).toBe('--scale-1');
  });

  it('keeps every score in the tier it had on the old 10–100 scale', () => {
    const old = (s: number) => (s >= 85 ? 'exceptional' : s >= 72 ? 'strong' : s >= 58 ? 'decent' : s >= 42 ? 'mixed' : 'challenging');
    let differ = 0;
    // Every rating mix of two equally weighted metrics, and of three.
    for (let a = 1; a <= 10; a++)
      for (let b = 1; b <= 10; b++)
        for (let c = 1; c <= 10; c++) {
          const ratings = { temperature: a, visualBeauty: b, cleanliness: c };
          const now = calcScore(ratings, config)!;
          const before = Math.round(((a + b + c) / 30) * 1000) / 10;
          if (scoreTier(now).id !== old(before)) differ++;
        }
    expect(differ).toBe(0);
  });

  it('classifies individual ratings', () => {
    expect(ratingLevel(3)).toBe('low');
    expect(ratingLevel(5)).toBe('mid');
    expect(ratingLevel(8)).toBe('high');
  });
});
