import { describe, expect, it } from 'vitest';
import { filterEntries, mergeImported, normalizeEntry, sortEntries } from '../src/domain/entry';
import { makeEntry } from './fixtures';

describe('normalizeEntry', () => {
  it('accepts a well-formed entry unchanged', () => {
    const e = makeEntry();
    expect(normalizeEntry(e)).toEqual(e);
  });

  it('rejects entries missing required fields', () => {
    expect(normalizeEntry(null)).toBeNull();
    expect(normalizeEntry({ ...makeEntry(), city: '  ' })).toBeNull();
    expect(normalizeEntry({ ...makeEntry(), date: 'whenever' })).toBeNull();
  });

  it('clamps ratings, fills gaps and recomputes the score', () => {
    const e = normalizeEntry({ ...makeEntry(), ratings: { greenery: 99, safety: -3 }, score: 1 })!;
    expect(e.ratings.greenery).toBe(10);
    expect(e.ratings.safety).toBe(1);
    expect(e.ratings.internet).toBe(5);
    expect(e.score).not.toBe(1);
  });

  it('upgrades legacy week dates and fills an id', () => {
    const e = normalizeEntry({ ...makeEntry(), id: undefined, date: '2024-W10' })!;
    expect(e.date).toBe('2024-03');
    expect(e.id).toMatch(/[0-9a-f-]{36}/);
  });
});

describe('filterEntries / sortEntries', () => {
  const list = [
    makeEntry({ id: 'a', city: 'Lisbon', state: 'Portugal', date: '2023-04', score: 80 }),
    makeEntry({ id: 'b', city: 'austin', state: 'Texas', date: '2024-05', score: 60, notes: 'Great tacos' }),
    makeEntry({ id: 'c', city: 'Kyoto', state: 'Japan', date: '2022-11', score: 95 }),
  ];

  it('searches city, region and notes case-insensitively', () => {
    expect(filterEntries(list, 'TACOS').map((e) => e.id)).toEqual(['b']);
    expect(filterEntries(list, 'japan').map((e) => e.id)).toEqual(['c']);
    expect(filterEntries(list, '  ')).toHaveLength(3);
  });

  it('sorts by date, score and city', () => {
    expect(sortEntries(list, 'date').map((e) => e.id)).toEqual(['b', 'a', 'c']);
    expect(sortEntries(list, 'score').map((e) => e.id)).toEqual(['c', 'a', 'b']);
    expect(sortEntries(list, 'city').map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('mergeImported', () => {
  const existing = [makeEntry({ id: 'a', savedAt: '2024-06-01T00:00:00.000Z' })];

  it('adds new visits', () => {
    const plan = mergeImported(existing, [makeEntry({ id: 'z', city: 'Kyoto' })]);
    expect(plan).toMatchObject({ added: 1, updated: 0, unchanged: 0 });
  });

  it('replaces older copies matched by visit, keeping the local id', () => {
    const newer = makeEntry({ id: 'other', notes: 'newer', savedAt: '2024-07-01T00:00:00.000Z' });
    const plan = mergeImported(existing, [newer]);
    expect(plan.updated).toBe(1);
    expect(plan.toSave[0]).toMatchObject({ id: 'a', notes: 'newer' });
  });

  it('never overwrites newer local edits', () => {
    const older = makeEntry({ id: 'a', notes: 'stale', savedAt: '2024-01-01T00:00:00.000Z' });
    expect(mergeImported(existing, [older])).toMatchObject({ toSave: [], unchanged: 1 });
  });

  it('dedupes repeated visits within one import', () => {
    const plan = mergeImported([], [makeEntry({ id: 'x' }), makeEntry({ id: 'y' })]);
    expect(plan.added).toBe(1);
  });
});
