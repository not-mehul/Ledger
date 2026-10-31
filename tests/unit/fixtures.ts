import type { Entry } from '../../src/domain/entry';
import { defaultConfig } from '../../src/domain/metrics';
import en from '../../src/i18n/en';
import { translateWith, type Messages } from '../../src/i18n/index.svelte';

export const config = defaultConfig();
export const tEn = translateWith(en as Messages, 'en');
export const ctx = { config, t: tEn, locale: 'en' as const };

export function ratingsOf(value: number): Record<string, number> {
  return Object.fromEntries(config.metrics.map((m) => [m.id, value]));
}

export function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'e1',
    city: 'Austin',
    state: 'Texas',
    date: '2024-05',
    ratings: ratingsOf(7),
    notes: '',
    photos: [],
    savedAt: '2024-05-20T12:00:00.000Z',
    ...overrides,
  };
}
