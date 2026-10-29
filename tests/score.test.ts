import { describe, expect, it } from 'vitest';
import { METRICS } from '../src/domain/metrics';
import { calcScore, ratingColor, scoreTier } from '../src/domain/score';

const all = (v: number) => Object.fromEntries(METRICS.map((m) => [m.id, v]));

describe('calcScore', () => {
  it('maps uniform ratings onto 0–100', () => {
    expect(calcScore(all(10))).toBe(100);
    expect(calcScore(all(5))).toBe(50);
    expect(calcScore(all(1))).toBe(10);
  });

  it('treats missing ratings as the default of 5', () => {
    expect(calcScore({})).toBe(50);
  });

  it('weights heavier metrics more', () => {
    const heavy = calcScore({ ...all(5), greenery: 10 }); // weight 2
    const light = calcScore({ ...all(5), temperature: 10 }); // weight 1
    expect(heavy).toBeGreaterThan(light);
  });

  it('rounds to one decimal place', () => {
    const score = calcScore({ ...all(5), airQuality: 6 });
    expect(score).toBe(Math.round(score * 10) / 10);
  });
});

describe('scoreTier', () => {
  it('picks tiers at their boundaries', () => {
    expect(scoreTier(85).description).toMatch(/^Exceptional/);
    expect(scoreTier(84.9).description).toMatch(/^Strong/);
    expect(scoreTier(58).description).toMatch(/^Decent/);
    expect(scoreTier(42).description).toMatch(/^Mixed/);
    expect(scoreTier(0).description).toMatch(/^Challenging/);
  });
});

describe('ratingColor', () => {
  it('flags low and high ratings', () => {
    expect(ratingColor(3)).toBe('#f87171');
    expect(ratingColor(5)).toBe('#d4a574');
    expect(ratingColor(8)).toBe('#9fb3a0');
  });
});
