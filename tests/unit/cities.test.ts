import { describe, expect, it } from 'vitest';
import { continentOf } from '../../src/domain/continents';
import { normalizeSettings } from '../../src/domain/doc';
import { citiesOf, rankCities, worldStats } from '../../src/domain/insights';
import { config, makeEntry, ratingsOf } from './fixtures';

const austin1 = makeEntry({ id: 'a1', city: 'Austin', state: 'Texas', country: 'US', date: '2023-03', ratings: ratingsOf(10) });
const austin2 = makeEntry({ id: 'a2', city: 'austin', state: 'texas', country: 'US', date: '2025-03', ratings: ratingsOf(4) });
const kyoto = makeEntry({ id: 'k', city: 'Kyoto', state: 'Japan', country: 'JP', date: '2024-04', ratings: ratingsOf(8) });
const lisbon = makeEntry({ id: 'l', city: 'Lisbon', state: 'Portugal', country: 'PT', date: '2024-05', ratings: ratingsOf(6) });
const porto = makeEntry({ id: 'p', city: 'Porto', state: 'Portugal', country: 'PT', date: '2024-06', ratings: {} });

describe('cities across visits', () => {
  it('puts visits to one city together, oldest first, latest city first', () => {
    const cities = citiesOf([kyoto, austin2, austin1, lisbon]);
    expect(cities.map((c) => c.city)).toEqual(['austin', 'Lisbon', 'Kyoto']);
    expect(cities[0]!.visits.map((v) => v.id)).toEqual(['a1', 'a2']);
    expect(cities[0]!.latest.id).toBe('a2');
  });

  it('ranks each city once, by its average over the visits that have the measure', () => {
    const ranked = rankCities([austin1, austin2, kyoto, lisbon, porto], config, { kind: 'score' });
    expect(ranked.map((r) => [r.entry.city, r.value, r.visits])).toEqual([
      ['Kyoto', 77.8, 1],
      ['austin', 66.7, 2],
      ['Lisbon', 55.6, 1],
    ]);
    // Opening it opens the latest visit.
    expect(ranked[1]!.entry.id).toBe('a2');
    expect(rankCities([austin1, austin2], config, { kind: 'metric', id: 'safety' })[0]).toMatchObject({ value: 7, visits: 2 });
  });
});

describe('world stats', () => {
  it('counts countries and the continents they are on', () => {
    expect(continentOf('PT')).toBe('EU');
    expect(continentOf('JP')).toBe('AS');
    expect(continentOf('ZZ')).toBeUndefined();
    expect(worldStats([austin1, kyoto, lisbon, porto])).toEqual({
      countries: 3,
      continents: [
        { id: 'AS', countries: 1 },
        { id: 'EU', countries: 1 },
        { id: 'NA', countries: 1 },
      ],
    });
    expect(worldStats([makeEntry({ country: undefined })])).toEqual({ countries: 0, continents: [] });
  });
});

describe('home city setting', () => {
  it('keeps a well-formed home and drops anything else', () => {
    expect(normalizeSettings({ homeCity: { city: ' Austin ', state: 'Texas' } }).homeCity).toEqual({ city: 'Austin', state: 'Texas' });
    expect(normalizeSettings({ homeCity: { city: '', state: 'Texas' } }).homeCity).toBeUndefined();
    expect(normalizeSettings({ homeCity: 'Austin' }).homeCity).toBeUndefined();
    expect(normalizeSettings({}).homeCity).toBeUndefined();
  });
});
