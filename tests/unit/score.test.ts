import { describe, expect, it } from 'vitest';
import { updateMetric } from '../../src/domain/metrics';
import { calcScore, ratingLevel, scoreTier } from '../../src/domain/score';
import { config, ratingsOf } from './fixtures';

describe('calcScore', () => {
  it('maps uniform ratings onto 0–100', () => {
    expect(calcScore(ratingsOf(10), config)).toBe(100);
    expect(calcScore(ratingsOf(5), config)).toBe(50);
    expect(calcScore(ratingsOf(1), config)).toBe(10);
  });

  it('returns null when nothing is rated', () => {
    expect(calcScore({}, config)).toBeNull();
  });

  it('ignores unrated and unknown metrics instead of assuming a default', () => {
    expect(calcScore({ greenery: 8 }, config)).toBe(80);
    expect(calcScore({ greenery: 8, mystery: 1 }, config)).toBe(80);
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
    expect(calcScore(ratings, hidden)).toBe(50);
  });
});

describe('scoreTier / ratingLevel', () => {
  it('picks tiers at their boundaries', () => {
    expect(scoreTier(85).id).toBe('exceptional');
    expect(scoreTier(84.9).id).toBe('strong');
    expect(scoreTier(58).id).toBe('decent');
    expect(scoreTier(42).id).toBe('mixed');
    expect(scoreTier(0).id).toBe('challenging');
    expect(scoreTier(90).cssVar).toBe('--scale-1');
  });

  it('classifies individual ratings', () => {
    expect(ratingLevel(3)).toBe('low');
    expect(ratingLevel(5)).toBe('mid');
    expect(ratingLevel(8)).toBe('high');
  });
});
