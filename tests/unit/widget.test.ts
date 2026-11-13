import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en';
import { translateWith, type Messages } from '../../src/i18n/index.svelte';
import { widgetLines } from '../../src/platform/widget';
import type { Entry } from '../../src/domain/entry';

const t = translateWith(en as Messages, 'en');
const entry = (city: string, state: string, date: string, country?: string): Entry => ({
  id: city + date,
  city,
  state,
  ...(country ? { country } : {}),
  date,
  ratings: {},
  notes: '',
  photos: [],
  savedAt: '2026-01-01T00:00:00.000Z',
});

describe('widget lines', () => {
  it('invites a first city on an empty ledger', () => {
    expect(widgetLines([], () => null, t, 'en')).toEqual({ headline: 'Ledger', detail: 'Add your first city', latest: '', score: '' });
  });

  it('counts cities and countries and names the latest visit with its score', () => {
    const entries = [
      entry('Lisbon', 'Portugal', '2025-05', 'PT'),
      entry('Porto', 'Portugal', '2025-06', 'PT'),
      entry('Lisbon', 'Portugal', '2026-02', 'PT'),
      entry('Austin', 'Texas', '2024-01', 'US'),
    ];
    const lines = widgetLines(entries, (e) => (e.city === 'Lisbon' ? 78.4 : null), t, 'en-US');
    expect(lines.headline).toBe('3 cities');
    expect(lines.detail).toBe('2 countries');
    expect(lines.latest).toMatch(/^Latest: Lisbon · Feb/);
    expect(lines.score).toBe('78');
  });
});
