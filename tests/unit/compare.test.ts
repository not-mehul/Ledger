import { describe, expect, it } from 'vitest';
import { compare, leadersOf } from '../../src/domain/compare';
import { config, makeEntry, ratingsOf } from './fixtures';

describe('leadersOf', () => {
  it('marks the highest value, ties included', () => {
    expect(leadersOf([3, 8, 8])).toEqual([1, 2]);
    expect(leadersOf([9, null, 4])).toEqual([0]);
  });

  it('is no contest when all are equal or only one rated it', () => {
    expect(leadersOf([5, 5])).toEqual([]);
    expect(leadersOf([5, null])).toEqual([]);
  });
});

describe('compare', () => {
  const a = makeEntry({ id: 'a', ratings: { ...ratingsOf(6), foodQuality: 9 } });
  const b = makeEntry({ id: 'b', ratings: { ...ratingsOf(6), safety: 9, internet: 9 } });

  it('groups rows by category and counts outright wins', () => {
    const c = compare([a, b], config);
    expect(c.groups.map((g) => g.category.id)).toEqual(['env', 'city', 'food', 'people', 'practical', 'overall']);
    expect(c.wins).toEqual([1, 2]);
    const food = c.groups.find((g) => g.category.id === 'food')!;
    expect(food.rows[0]!.leaders).toEqual([0]);
    expect(food.leaders).toEqual([0]);
    expect(c.scoreLeaders).toEqual([1]);
  });

  it('skips metrics nobody rated', () => {
    const c = compare([makeEntry({ ratings: { safety: 7 } }), makeEntry({ ratings: { safety: 3 } })], config);
    expect(c.groups).toHaveLength(1);
    expect(c.groups[0]!.rows.map((r) => r.metric.id)).toEqual(['safety']);
  });
});
