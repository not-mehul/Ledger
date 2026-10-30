import { describe, expect, it } from 'vitest';
import { currentMonthString, formatMonth, normalizeMonth, parseMonth, toMonthString } from '../../src/lib/dates';

describe('dates', () => {
  it('formats month strings', () => {
    expect(toMonthString(2024, 0)).toBe('2024-01');
    expect(currentMonthString(new Date(2025, 11, 31))).toBe('2025-12');
    expect(formatMonth('2024-05')).toBe('May 2024');
  });

  it('normalises supported inputs to YYYY-MM', () => {
    expect(normalizeMonth('2024-05')).toBe('2024-05');
    expect(normalizeMonth('2024-05-17')).toBe('2024-05');
    expect(normalizeMonth('2024-W01')).toBe('2024-01');
    expect(normalizeMonth('2020-W01')).toBe('2019-12'); // ISO week 1 of 2020 starts Mon 30 Dec 2019
  });

  it('rejects invalid input', () => {
    expect(normalizeMonth('')).toBeNull();
    expect(normalizeMonth(undefined)).toBeNull();
    expect(normalizeMonth('2024-13')).toBeNull();
    expect(normalizeMonth('May 2024')).toBeNull();
    expect(parseMonth('nope')).toBeNull();
  });
});
