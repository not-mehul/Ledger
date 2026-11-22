// Regression tests for the November 2026 audit. Each names the finding it guards.
import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../../src/domain/doc';
import { mergeImported, nextSavedAt, normalizeEntry } from '../../src/domain/entry';
import { activeMetrics, defaultConfig, normalizeConfig } from '../../src/domain/metrics';
import { mergeEntries } from '../../src/domain/sync-merge';
import { yearReview } from '../../src/domain/insights';
import { formatMonth, normalizeMonth } from '../../src/lib/dates';
import { buildMarkdown, parseMarkdown } from '../../src/lib/markdown';
import { isBackupDue } from '../../src/lib/schedule';
import { widgetLines } from '../../src/platform/widget';
import { config, ctx, makeEntry, tEn } from './fixtures';

describe('imports', () => {
  it('M1: line and paragraph separators survive a Markdown round trip', () => {
    for (const notes of ['pasted\u2028text', 'pasted\u2029text', 'end --> here\nline 🏙️ | pipe\tx']) {
      const parsed = parseMarkdown(buildMarkdown([makeEntry({ notes, city: `A\u2028B` })], ctx));
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0]!.notes).toBe(notes);
      expect(parsed.entries[0]!.city).toBe('A\u2028B');
    }
  });

  it('M1: files exported before the fix, with raw separators, still import', () => {
    const json = JSON.stringify(makeEntry({ notes: 'a\u2028b' }));
    expect(parseMarkdown(`<!-- data:${json} -->`).entries).toHaveLength(1);
  });

  it('L1: null, empty and boolean ratings are unrated; numeric strings count', () => {
    const e = normalizeEntry({ city: 'A', state: 'B', date: '2024-01', ratings: { greenery: null, safety: '', internet: true, walkability: '7', temperature: 11 } });
    expect(e!.ratings).toEqual({ walkability: 7, temperature: 10 });
  });

  it('L2: an id match wins over a visit match earlier in the list', () => {
    const byVisit = makeEntry({ id: 'B', city: 'Lisbon', state: 'Portugal', date: '2024-05', savedAt: '2024-01-01T00:00:00Z' });
    const byId = makeEntry({ id: 'A', city: 'Lisbon', state: 'Portugal', date: '2023-01', savedAt: '2024-01-01T00:00:00Z' });
    const incoming = makeEntry({ id: 'A', city: 'Lisbon', state: 'Portugal', date: '2024-05', savedAt: '2025-01-01T00:00:00Z' });
    expect(mergeImported([byVisit, byId], [incoming]).toSave[0]!.id).toBe('A');
  });
});

describe('timestamps', () => {
  const now = Date.parse('2026-11-22T12:00:00Z');

  it('M5: a far-future savedAt is treated as now', () => {
    expect(normalizeEntry(makeEntry({ savedAt: '2099-01-01T00:00:00Z' }), now)!.savedAt).toBe(new Date(now).toISOString());
    // A few hours of clock drift is left alone.
    const drift = new Date(now + 3 * 3_600_000).toISOString();
    expect(normalizeEntry(makeEntry({ savedAt: drift }), now)!.savedAt).toBe(drift);
  });

  it('M5: a save is always later than the copy it replaces', () => {
    const ahead = new Date(now + 3_600_000).toISOString();
    expect(Date.parse(nextSavedAt(ahead, now))).toBeGreaterThan(Date.parse(ahead));
    expect(nextSavedAt(undefined, now)).toBe(new Date(now).toISOString());
    expect(nextSavedAt('2020-01-01T00:00:00Z', now)).toBe(new Date(now).toISOString());
  });

  it('M5: after the fix an edit beats a once-future copy in sync', () => {
    const stale = normalizeEntry(makeEntry({ savedAt: '2099-01-01T00:00:00Z', notes: 'stale' }), now)!;
    const edit = { ...stale, notes: 'edited', savedAt: nextSavedAt(stale.savedAt, now + 1000) };
    expect(mergeEntries([edit], [stale], {}).merged[0]!.notes).toBe('edited');
  });

  it('L5: a lastBackupAt in the future makes a backup due', () => {
    const future = new Date(now + 90 * 86_400_000).toISOString();
    expect(normalizeSettings({ lastBackupAt: future }).lastBackupAt).toBe(future);
    expect(isBackupDue('daily', future, now)).toBe(true);
    expect(isBackupDue('daily', new Date(now - 3_600_000).toISOString(), now)).toBe(false);
  });
});

describe('sync', () => {
  it('L3: the same visit logged on two phones becomes one entry, the newest', () => {
    const a = makeEntry({ id: 'phoneA', savedAt: '2026-01-01T00:00:00Z', notes: 'a' });
    const b = makeEntry({ id: 'phoneB', savedAt: '2026-02-01T00:00:00Z', notes: 'b' });
    const here = mergeEntries([a], [b], {});
    expect(here.merged.map((e) => e.id)).toEqual(['phoneB']);
    expect(here.removed).toEqual(['phoneA']);
    expect(here.base).toEqual({ phoneB: b.savedAt });
    // The other phone ends up the same, and the folder then agrees.
    const there = mergeEntries([b], here.merged, {});
    expect(there.merged.map((e) => e.id)).toEqual(['phoneB']);
  });

  it('L3: equal times keep the same entry on both phones', () => {
    const a = makeEntry({ id: 'a1' });
    const b = makeEntry({ id: 'b1' });
    expect(mergeEntries([a], [b], {}).merged[0]!.id).toBe('a1');
    expect(mergeEntries([b], [a], {}).merged[0]!.id).toBe('a1');
  });
});

describe('config', () => {
  it('L4: a config with nothing to rate falls back to the defaults', () => {
    const c = normalizeConfig({
      categories: [{ id: 'env', archived: true }, { id: 'x' }],
      metrics: [{ id: 'greenery', cat: 'env', weight: 1 }],
    });
    expect(c).toEqual(defaultConfig());
    expect(activeMetrics(c).length).toBeGreaterThan(0);
  });
});

describe('dates', () => {
  it('L13: years before 100 keep their year, and only real ISO weeks are read', () => {
    expect(formatMonth('0050-03')).toBe('March 50');
    expect(normalizeMonth('2026-W00')).toBeNull();
    expect(normalizeMonth('2026-W54')).toBeNull();
    expect(normalizeMonth('2026-W53')).toBe('2026-12');
    expect(normalizeMonth('2026-W1')).toBe('2025-12');
  });
});

describe('widget', () => {
  it('L6: the widget counts countries as Insights does', () => {
    const entries = [
      makeEntry({ id: '1', city: 'Austin', state: 'Texas', country: 'US' }),
      makeEntry({ id: '2', city: 'Dallas', state: 'Texas' }),
      makeEntry({ id: '3', city: 'Denver', state: 'Colorado' }),
    ];
    expect(widgetLines(entries, () => 70, tEn, 'en').detail).toBe('1 country');
    expect(yearReview(entries, config, null).countries).toEqual(['US']);
  });
});
