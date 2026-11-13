import { describe, expect, it } from 'vitest';
import { baseOf, mergeEntries } from '../../src/domain/sync-merge';
import type { Entry } from '../../src/domain/entry';

const entry = (id: string, savedAt: string, city = id): Entry => ({
  id,
  city,
  state: 'Region',
  date: '2025-05',
  ratings: {},
  notes: '',
  photos: [],
  savedAt,
});

const T1 = '2026-01-01T10:00:00.000Z';
const T2 = '2026-01-02T10:00:00.000Z';

describe('folder sync merge', () => {
  it('takes new entries from both sides on the first sync', () => {
    const m = mergeEntries([entry('a', T1)], [entry('b', T1)]);
    expect(m.merged.map((e) => e.id).sort()).toEqual(['a', 'b']);
    expect(m.incoming.map((e) => e.id)).toEqual(['b']);
    expect(m.removed).toEqual([]);
    expect(m.base).toEqual({ a: T1, b: T1 });
  });

  it('keeps whichever copy was saved last', () => {
    const m = mergeEntries([entry('a', T1, 'Old')], [entry('a', T2, 'New')], { a: T1 });
    expect(m.merged[0]!.city).toBe('New');
    expect(m.incoming).toHaveLength(1);
    const back = mergeEntries([entry('a', T2, 'Mine')], [entry('a', T1, 'Theirs')], { a: T1 });
    expect(back.merged[0]!.city).toBe('Mine');
    expect(back.incoming).toHaveLength(0);
  });

  it('carries deletions both ways', () => {
    const base = baseOf([entry('a', T1), entry('b', T1)]);
    // Deleted on the other phone.
    const there = mergeEntries([entry('a', T1), entry('b', T1)], [entry('a', T1)], base);
    expect(there.removed).toEqual(['b']);
    expect(there.merged.map((e) => e.id)).toEqual(['a']);
    // Deleted here.
    const here = mergeEntries([entry('a', T1)], [entry('a', T1), entry('b', T1)], base);
    expect(here.incoming).toEqual([]);
    expect(here.merged.map((e) => e.id)).toEqual(['a']);
  });

  it('lets an edit outweigh a deletion on the other phone', () => {
    const base = { a: T1 };
    const editedHere = mergeEntries([entry('a', T2)], [], base);
    expect(editedHere.removed).toEqual([]);
    expect(editedHere.merged).toHaveLength(1);
    const editedThere = mergeEntries([], [entry('a', T2)], base);
    expect(editedThere.incoming).toHaveLength(1);
  });
});
