import { describe, expect, it } from 'vitest';
import { buildCsv, csvField } from '../../src/lib/csv';
import en from '../../src/i18n/en';
import { config, makeEntry, ratingsOf } from './fixtures';

const t = (key: string, params?: Record<string, string | number>) => {
  const v = (en as Record<string, unknown>)[key];
  return typeof v === 'string' ? v.replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k] ?? '')) : key;
};

describe('csv export', () => {
  it('quotes what needs quoting and keeps formulas as text', () => {
    expect(csvField('Lisbon')).toBe('Lisbon');
    expect(csvField('Washington, D.C.')).toBe('"Washington, D.C."');
    expect(csvField('Said "wow"')).toBe('"Said ""wow"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField(-3)).toBe('-3');
    expect(csvField(null)).toBe('');
  });

  it('writes one row per visit, oldest first, a column per metric', () => {
    const csv = buildCsv(
      [
        makeEntry({ id: 'b', city: 'Kyoto', state: 'Japan', country: 'JP', date: '2025-04', ratings: { ...ratingsOf(10), internet: 1 }, notes: 'Temples, "quiet"' }),
        makeEntry({ id: 'a', city: 'Austin', state: 'Texas', country: 'US', date: '2024-03', ratings: { greenery: 7 } }),
      ],
      { config, t: t as never, countryName: (c) => ({ US: 'United States', JP: 'Japan' })[c] ?? c },
    );
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);
    const header = lines[0]!.split(',');
    expect(header.slice(0, 6)).toEqual(['City', 'Region', 'Country', 'Month', 'Score', 'Tier']);
    expect(header).toHaveLength(6 + config.metrics.length + 1);
    expect(header.at(-1)).toBe('Notes');
    expect(lines[1]!.startsWith('Austin,Texas,United States,2024-03,66.7,Decent,7,')).toBe(true);
    // Unrated metrics are empty cells.
    expect(lines[1]!.split(',').slice(7, 9)).toEqual(['', '']);
    expect(lines[2]).toContain('Kyoto,Japan,Japan,2025-04,');
    expect(lines[2]!.endsWith(',"Temples, ""quiet"""')).toBe(true);
  });
});
