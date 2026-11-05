import { describe, expect, it } from 'vitest';
import { readLedgerLink } from '../../src/platform/incoming';

describe('ledger:// links', () => {
  it('starts an entry with the place and the month of the date', () => {
    expect(readLedgerLink('ledger://add?city=S%C3%A3o+Paulo&country=br&date=2026-10-02&source=waymark')).toEqual({
      city: 'São Paulo',
      region: '',
      country: 'BR',
      month: '2026-10',
    });
  });

  it('takes a month, a region, and no date at all', () => {
    expect(readLedgerLink('ledger://add?city=Austin&region=Texas&date=2025-03')).toEqual({
      city: 'Austin',
      region: 'Texas',
      country: undefined,
      month: '2025-03',
    });
    expect(readLedgerLink('ledger://add?city=Austin')).toMatchObject({ month: null });
    expect(readLedgerLink('ledger://add?city=Austin&date=soon')).toMatchObject({ month: null });
  });

  it('drops a country that is not a two-letter code', () => {
    expect(readLedgerLink('ledger://add?city=Lyon&country=France')).toMatchObject({ country: undefined });
  });

  it('just opens for open, unknown actions and an add without a city', () => {
    expect(readLedgerLink('ledger://open')).toBe('open');
    expect(readLedgerLink('ledger://rate?city=Lyon')).toBe('open');
    expect(readLedgerLink('ledger://add?country=FR')).toBe('open');
  });

  it('ignores links to other apps and files', () => {
    expect(readLedgerLink('waymark://open')).toBeNull();
    expect(readLedgerLink('content://downloads/1')).toBeNull();
  });
});
