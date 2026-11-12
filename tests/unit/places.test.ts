import { readWorldPlaces } from 'dusk-dawn/places/vite';
import { parsePlaces } from 'dusk-dawn/places';
import { describe, expect, it } from 'vitest';
import { buildIndex, describe as describePlace, fold, matchPlace, regionFor, searchPlaces } from '../../src/lib/places';

// The same file the app ships: towns only, from dusk-dawn.
const index = buildIndex(parsePlaces(readWorldPlaces({ kinds: ['city'] })));

describe('places', () => {
  it('covers the world down to small towns', () => {
    expect(index.world.size).toBeGreaterThan(200_000);
    // Zermatt has about 6,000 people; the old list started at 15,000.
    expect(matchPlace(index, 'Zermatt', 'Switzerland')?.country).toBe('CH');
    expect(matchPlace(index, 'Giethoorn', 'Netherlands')?.lat).toBeCloseTo(52.74, 1);
  });

  it('folds accents, case and punctuation', () => {
    expect(fold('São  Paulo!')).toBe('sao paulo');
  });

  it('searches by prefix, then by word, largest first', () => {
    expect(searchPlaces(index, 'par')[0]!.name).toBe('Paris');
    expect(describePlace(searchPlaces(index, 'par')[0]!)).toBe('Île-de-France, France');
    expect(searchPlaces(index, 'york city').map((p) => p.name)).toContain('New York City');
    expect(searchPlaces(index, 'sao pa')[0]!.name).toBe('São Paulo');
    expect(searchPlaces(index, 'p')).toEqual([]);
    expect(searchPlaces(index, 'eiffel').every((p) => p.name !== 'Eiffel Tower')).toBe(true); // towns only
  });

  it('fills the region with the state for US-style countries, else the country', () => {
    expect(regionFor(matchPlace(index, 'Austin', 'Texas')!)).toBe('Texas');
    expect(regionFor(searchPlaces(index, 'london')[0]!)).toBe('United Kingdom');
  });

  it('matches typed entries conservatively', () => {
    expect(matchPlace(index, 'Paris', 'Texas')?.country).toBe('US');
    expect(matchPlace(index, 'paris', 'France')?.country).toBe('FR');
    expect(matchPlace(index, 'London', 'England')?.country).toBe('GB');
    expect(matchPlace(index, 'Austin', 'USA')?.admin1).toBe('Texas');
    expect(matchPlace(index, 'Bombay', 'India')?.name).toBe('Mumbai');
    expect(matchPlace(index, 'Paris', 'Narnia')).toBeNull(); // ambiguous
    expect(matchPlace(index, 'Paris', '')?.country).toBe('FR'); // the largest
    expect(matchPlace(index, 'Nowhereville', '')).toBeNull();
  });

  it('pins a town where it is, to within a few hundred metres', () => {
    const kyoto = matchPlace(index, 'Kyoto', 'Japan')!;
    expect(kyoto.lat).toBeCloseTo(35.02, 1);
    expect(kyoto.lon).toBeCloseTo(135.75, 1);
  });

  it('maps ISO numeric codes for map shapes', () => {
    expect(index.numericToIso.get(840)).toBe('US');
    expect(index.numericToIso.get(392)).toBe('JP');
  });
});
