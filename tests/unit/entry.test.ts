import { describe, expect, it } from 'vitest';
import { applyUpserts, filterEntries, mergeImported, normalizeEntry, sortEntries } from '../../src/domain/entry';
import { makeEntry } from './fixtures';

describe('normalizeEntry', () => {
  it('accepts a well-formed entry unchanged', () => {
    const e = makeEntry({ country: 'US', lat: 30.27, lon: -97.74, photos: [{ id: 'p1', width: 10, height: 20 }] });
    expect(normalizeEntry(e)).toEqual(e);
  });

  it('rejects entries missing required fields', () => {
    expect(normalizeEntry(null)).toBeNull();
    expect(normalizeEntry({ ...makeEntry(), city: '  ' })).toBeNull();
    expect(normalizeEntry({ ...makeEntry(), date: 'whenever' })).toBeNull();
  });

  it('clamps ratings and keeps only what was rated', () => {
    const e = normalizeEntry({ ...makeEntry(), ratings: { greenery: 99, safety: -3, internet: 'x', custom: 4 } })!;
    expect(e.ratings).toEqual({ greenery: 10, safety: 1, custom: 4 });
  });

  it('drops invalid coordinates, countries and photo ids', () => {
    const e = normalizeEntry({ ...makeEntry(), country: 'usa', lat: 120, lon: 3, photos: [{ id: '../evil' }, { id: 'ok' }] })!;
    expect(e).not.toHaveProperty('country');
    expect(e).not.toHaveProperty('lat');
    expect(e.photos).toEqual([{ id: 'ok', width: 0, height: 0 }]);
  });

  it('ignores a stored score and upgrades legacy week dates', () => {
    const e = normalizeEntry({ ...makeEntry(), id: undefined, date: '2024-W10', score: 12 })!;
    expect(e).not.toHaveProperty('score');
    expect(e.date).toBe('2024-03');
    expect(e.id).toMatch(/[0-9a-f-]{36}/);
  });
});

describe('filterEntries / sortEntries', () => {
  const list = [
    makeEntry({ id: 'a', city: 'Lisbon', state: 'Portugal', date: '2023-04' }),
    makeEntry({ id: 'b', city: 'austin', state: 'Texas', date: '2024-05', notes: 'Great tacos' }),
    makeEntry({ id: 'c', city: 'Kyoto', state: 'Japan', date: '2022-11' }),
  ];
  const scores: Record<string, number | null> = { a: 80, b: null, c: 95 };

  it('searches city, region and notes case-insensitively', () => {
    expect(filterEntries(list, 'TACOS').map((e) => e.id)).toEqual(['b']);
    expect(filterEntries(list, 'japan').map((e) => e.id)).toEqual(['c']);
    expect(filterEntries(list, '  ')).toHaveLength(3);
  });

  it('sorts by date, score (unscored last) and city', () => {
    expect(sortEntries(list, 'date').map((e) => e.id)).toEqual(['b', 'a', 'c']);
    expect(sortEntries(list, 'score', (e) => scores[e.id]!).map((e) => e.id)).toEqual(['c', 'a', 'b']);
    expect(sortEntries(list, 'city').map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('mergeImported / applyUpserts', () => {
  const existing = [makeEntry({ id: 'a', savedAt: '2024-06-01T00:00:00.000Z' })];

  it('adds new visits', () => {
    expect(mergeImported(existing, [makeEntry({ id: 'z', city: 'Kyoto' })])).toMatchObject({ added: 1, updated: 0 });
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
    expect(mergeImported([], [makeEntry({ id: 'x' }), makeEntry({ id: 'y' })]).added).toBe(1);
  });

  it('upserts by id, preserving order', () => {
    const merged = applyUpserts([makeEntry({ id: 'a' }), makeEntry({ id: 'b' })], [makeEntry({ id: 'a', notes: 'x' }), makeEntry({ id: 'c' })]);
    expect(merged.map((e) => [e.id, e.notes])).toEqual([['a', 'x'], ['b', ''], ['c', '']]);
  });
});
