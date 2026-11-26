import { readWorldPlaces } from 'dusk-dawn/places/vite';
import { parsePlaces } from 'dusk-dawn/places';
import { describe, expect, it } from 'vitest';
import { buildIndex, describe as describePlace, fold, matchPlace, nearbyPlaces, placeFromText, regionFor, searchPlaces } from '../../src/lib/places';
import { QUICK_MIN_RANK } from '../../src/lib/places-tiers';

// The same file the app ships: towns only, from dusk-dawn.
const index = buildIndex(parsePlaces(readWorldPlaces({ kinds: ['city'] })));

// And the quick file the city field reads first.
const quick = buildIndex(parsePlaces(readWorldPlaces({ kinds: ['city'], minRank: QUICK_MIN_RANK })));

describe('places', () => {
  it('the quick list answers the usual searches as the whole list does', () => {
    expect(quick.world.size).toBeLessThan(index.world.size / 3);
    for (const q of ['par', 'porto', 'bombay', 'sao pa', 'lond', 'new y', 'kyo', 'berl']) {
      const wanted = searchPlaces(index, q, 50).filter((p) => p.rank >= QUICK_MIN_RANK).slice(0, 6);
      expect(searchPlaces(quick, q).map((p) => [p.name, p.country]), q).toEqual(wanted.map((p) => [p.name, p.country]));
    }
    // Small towns wait for the whole list.
    expect(searchPlaces(quick, 'zermatt')).toEqual([]);
    expect(searchPlaces(index, 'zermatt')[0]?.country).toBe('CH');
    // Every country is there to name and to match map shapes.
    expect(quick.numericToIso.size).toBe(index.numericToIso.size);
  });

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

  it('puts an exact name ahead of longer, more populous ones', () => {
    // Porto Alegre is far larger than Porto, but "porto" means Porto.
    expect(searchPlaces(index, 'porto')[0]!.country).toBe('PT');
    expect(searchPlaces(index, 'porto').map((p) => p.name)).toContain('Porto Alegre');
    expect(searchPlaces(index, 'bombay')[0]!.name).toBe('Mumbai');
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

describe('nearbyPlaces', () => {
  it('puts the city you are in before the towns closer to its centre point', () => {
    // The Praça do Comércio, Lisbon.
    const near = nearbyPlaces(index, 38.7077, -9.1365);
    expect(near[0]?.name).toBe('Lisbon');
    expect(near.length).toBeGreaterThan(1);
    // A field outside a small town: the town itself.
    const town = nearbyPlaces(index, 47.5622, 13.6493);
    expect(town.some((p) => p.name === 'Hallstatt')).toBe(true);
    expect(nearbyPlaces(index, 0, -30)).toEqual([]);
  });
});

describe('placeFromText', () => {
  const name = (text: string) => {
    const p = placeFromText(index, text);
    return p && `${p.name} ${p.country}`;
  };
  it('finds the town in an address shared from a map app', () => {
    expect(name('A Brasileira\nRua Garrett 120, 1200-273 Lisboa, Portugal\nhttps://maps.app.goo.gl/abc123')).toBe('Lisbon PT');
    expect(name('Eiffel Tower, Av. Gustave Eiffel, 75007 Paris, France')).toBe('Paris FR');
    expect(name('1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA')).toBe('Mountain View US');
    expect(name('Marienplatz 1, 80331 München, Deutschland')).toBe('Munich DE');
    expect(name('10 Downing St, London SW1A 2AA, UK')).toBe('London GB');
  });
  it('uses coordinates in a map link', () => {
    expect(name('https://www.google.com/maps/place/x/@38.7077,-9.1365,17z')).toBe('Lisbon PT');
    expect(name('geo:35.0116,135.7681')).toBe('Kyoto JP');
  });
  it('gives up when nothing names a town', () => {
    expect(placeFromText(index, 'https://maps.app.goo.gl/abc123')).toBeNull();
    expect(placeFromText(index, 'Great coffee here!')).toBeNull();
  });
});
