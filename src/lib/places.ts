// ============================================================
// Offline place lookup backed by the shared world gazetteer in dusk-dawn
// (GeoNames, CC BY 4.0): every town of 1,000 people or more, each with its
// state or province, so the map pins the city itself rather than the nearest
// big one. Waymark reads the same file. vite.config.ts ships the towns only,
// as data/places.txt.
// ============================================================

import { foldPlaceName, parsePlacesInSlices, type Gazetteer, type WorldPlace } from 'dusk-dawn/places';

export interface Place {
  /** Stable within one copy of the gazetteer; for keys, not for storage. */
  id: number;
  name: string;
  admin1: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  countryName: string;
  lat: number;
  lon: number;
  /** Higher is larger: 8 × log10 of population. */
  rank: number;
}

export interface PlaceIndex {
  world: Gazetteer;
  countryNames: Map<string, string>;
  /** ISO 3166-1 numeric → alpha-2, for matching map shapes. */
  numericToIso: Map<number, string>;
}

/** Countries where people usually name the state/province, not the country. */
const REGION_BY_ADMIN1 = new Set(['US', 'CA', 'AU']);

/** Lowercase, strip accents and punctuation so "São Paulo" matches "sao paulo". */
export const fold = foldPlaceName;

export function toPlace(p: WorldPlace): Place {
  return {
    id: p.id,
    name: p.name,
    admin1: p.region,
    country: p.country,
    countryName: p.countryName,
    lat: p.latitude,
    lon: p.longitude,
    rank: p.rank,
  };
}

export function buildIndex(world: Gazetteer): PlaceIndex {
  return {
    world,
    countryNames: new Map(world.countries.map((c) => [c.code, c.name])),
    numericToIso: new Map(world.countries.map((c) => [c.numeric, c.code])),
  };
}

const loading = new Map<string, Promise<PlaceIndex>>();

/** Fetches and indexes a places file once, a slice at a time; later calls share the result. */
function load(url: string): Promise<PlaceIndex> {
  let p = loading.get(url);
  if (!p) {
    p = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => parsePlacesInSlices(text, { kinds: ['city'] }))
      .then(buildIndex)
      .catch((err: unknown) => {
        loading.delete(url);
        throw err;
      });
    loading.set(url, p);
  }
  return p;
}

/**
 * Every town of 1,000 people or more. Use it to match typed text to a pin
 * (matchPlace): the quick list could put a village on a larger namesake.
 */
export function loadPlaces(url = `${import.meta.env.BASE_URL}data/places.txt`): Promise<PlaceIndex> {
  return load(url);
}

/**
 * Towns of 10,000 or more: a fifth of the size, ready in a fraction of the
 * time. For suggestions while loadPlaces finishes; it finds the places most
 * people type, in the order the whole list would.
 */
export function loadQuickPlaces(url = `${import.meta.env.BASE_URL}data/places-quick.txt`): Promise<PlaceIndex> {
  return load(url);
}

/** The text that goes in the entry's "State / Country" field. */
export function regionFor(place: Place): string {
  return REGION_BY_ADMIN1.has(place.country) && place.admin1 ? place.admin1 : place.countryName;
}

/** "Texas, United States" — shown under each suggestion. */
export function describe(place: Place): string {
  return [place.admin1, place.countryName].filter(Boolean).join(', ');
}

/**
 * Exact names first, own or also-known-as ("porto" → Porto before Porto
 * Alegre, "bombay" → Mumbai), unless a prefix match is a hundred times
 * larger ("par" → Paris, not the Cornish village of Par); then prefix
 * matches on the whole name, then on later words ("york" → New York), each
 * group largest first.
 */
export function searchPlaces(index: PlaceIndex, query: string, limit = 6): Place[] {
  if (fold(query).length < 2) return [];
  const prefix = index.world.search(query, { limit: limit * 2, kinds: ['city'] });
  const top = prefix[0]?.rank ?? 0;
  const exact = index.world
    .named(query, { kinds: ['city'] })
    .filter((p) => p.rank >= top - EXACT_RANK_SLACK)
    .slice(0, limit);
  const seen = new Set(exact.map((p) => p.id));
  return [...exact, ...prefix.filter((p) => !seen.has(p.id))].slice(0, limit).map(toPlace);
}

/** Ranks are 8 × log10(population): 16 is a hundredfold. */
const EXACT_RANK_SLACK = 16;

const REGION_ALIASES: Record<string, string> = {
  usa: 'united states',
  us: 'united states',
  'u s a': 'united states',
  'united states of america': 'united states',
  america: 'united states',
  uk: 'united kingdom',
  'u k': 'united kingdom',
  britain: 'united kingdom',
  'great britain': 'united kingdom',
  england: 'united kingdom',
  scotland: 'united kingdom',
  wales: 'united kingdom',
  'northern ireland': 'united kingdom',
  uae: 'united arab emirates',
  holland: 'netherlands',
};

/**
 * Best-effort lookup for an entry typed without picking a suggestion.
 * Prefers a town of that name (or a name it is known by, "Bombay") whose
 * state/province or country matches the region text; otherwise accepts the
 * name only if it's unambiguous, or the largest town when no region was
 * given.
 */
export function matchPlace(index: PlaceIndex, city: string, region: string): Place | null {
  const r = fold(region);
  const country = REGION_ALIASES[r] ?? r;
  const candidates = index.world.named(city, { kinds: ['city'] });
  if (r) {
    const hit = candidates.find((p) => fold(p.region) === r || fold(p.countryName) === country || p.country.toLowerCase() === r);
    if (hit) return toPlace(hit);
  }
  return candidates.length === 1 || (!r && candidates.length) ? toPlace(candidates[0]!) : null;
}

/** Roughly how far a town's built-up area runs: 25 km for Paris, 3 km for a town of 5,000. */
function reachKm(rank: number): number {
  return 2 + Math.sqrt(10 ** (rank / 8) / 1000) / 2;
}

/**
 * The towns someone at this point is most likely in, best first: the largest
 * town whose area takes in the point (Lisbon, not the Baixa beside its centre
 * point), then the rest by distance. For "Near me".
 */
export function nearbyPlaces(index: PlaceIndex, lat: number, lon: number, limit = 5): (Place & { km: number })[] {
  const around = index.world.nearest(lat, lon, { limit: 15, withinKm: 50 }).map((p) => ({ ...toPlace(p), km: p.distanceKm }));
  const within = around.filter((p) => p.km <= reachKm(p.rank)).sort((a, b) => b.rank - a.rank || a.km - b.km);
  const rest = around.filter((p) => !within.includes(p));
  return [...within, ...rest].slice(0, limit);
}
