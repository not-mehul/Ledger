import { describe, expect, it } from 'vitest';
import { buildCsv, csvCell } from '../../src/lib/csv';
import { ctx, makeEntry } from './fixtures';

describe('csv', () => {
  it('quotes per RFC 4180 and defuses formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"\nbye')).toBe('"say ""hi""\nbye"');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(-97.5)).toBe('-97.5');
    expect(csvCell(undefined)).toBe('');
  });

  it('writes one row per entry with a column per metric', () => {
    const csv = buildCsv([makeEntry({ notes: 'Tacos, BBQ', lat: 30.27, lon: -97.74 })], ctx);
    const [header, row] = csv.replace('﻿', '').trim().split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(header!.split(',').slice(0, 6)).toEqual(['City', 'Region', 'Country', 'Month', 'Score', 'Greenery & Nature Access']);
    expect(row).toContain('Austin,Texas,,2024-05,70,7,');
    expect(row).toContain('"Tacos, BBQ",30.27,-97.74');
  });
});
