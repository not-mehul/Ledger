import { describe, expect, it } from 'vitest';
import { buildIndex, describe as describePlace, fold, matchPlace, regionFor, searchPlaces, type PlacesData } from '../../src/lib/places';

const data: PlacesData = {
  v: 1,
  countries: [['US', 'United States', 840], ['FR', 'France', 250], ['BR', 'Brazil', 76], ['GB', 'United Kingdom', 826]],
  admin1: ['', 'Texas', 'Île-de-France', 'São Paulo', 'England', 'New York'],
  cities: [
    'São Paulo|3|2|-23.55|-46.63',
    'New York City|5|0|40.71|-74.01',
    'Paris|2|1|48.85|2.35',
    'London|4|3|51.51|-0.13',
    'Austin|1|0|30.27|-97.74',
    'Paris|1|0|33.66|-95.56',
  ].join('\n'),
};
const index = buildIndex(data);

describe('places', () => {
  it('folds accents, case and punctuation', () => {
    expect(fold('São  Paulo!')).toBe('sao paulo');
  });

  it('searches by prefix, then by word, most populous first', () => {
    expect(searchPlaces(index, 'par').map(describePlace)).toEqual(['Île-de-France, France', 'Texas, United States']);
    expect(searchPlaces(index, 'york').map((p) => p.name)).toEqual(['New York City']);
    expect(searchPlaces(index, 'sao')[0]!.name).toBe('São Paulo');
    expect(searchPlaces(index, 'p')).toEqual([]);
  });

  it('fills the region with the state for US-style countries, else the country', () => {
    expect(regionFor(searchPlaces(index, 'austin')[0]!)).toBe('Texas');
    expect(regionFor(searchPlaces(index, 'london')[0]!)).toBe('United Kingdom');
  });

  it('matches typed entries conservatively', () => {
    expect(matchPlace(index, 'Paris', 'Texas')?.country).toBe('US');
    expect(matchPlace(index, 'paris', 'France')?.country).toBe('FR');
    expect(matchPlace(index, 'London', 'England')?.country).toBe('GB');
    expect(matchPlace(index, 'Austin', 'USA')?.admin1).toBe('Texas');
    expect(matchPlace(index, 'Paris', 'Narnia')).toBeNull(); // ambiguous
    expect(matchPlace(index, 'Austin', 'Narnia')?.name).toBe('Austin'); // unique name
    expect(matchPlace(index, 'Atlantis', '')).toBeNull();
  });

  it('maps ISO numeric codes for map shapes', () => {
    expect(index.numericToIso.get(840)).toBe('US');
  });
});
