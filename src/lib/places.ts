// ============================================================
// Offline city lookup backed by public/data/places.json (GeoNames,
// cities with 15k+ people; see scripts/build-places.mjs).
// ============================================================

export interface Place {
  name: string;
  admin1: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  countryName: string;
  lat: number;
  lon: number;
  /** Lower is more populous. */
  rank: number;
}

export interface PlacesData {
  v: number;
  countries: [string, string, number][];
  admin1: string[];
  cities: string;
}

export interface PlaceIndex {
  places: Place[];
  /** Folded names, parallel to `places`. */
  keys: string[];
  countryNames: Map<string, string>;
  /** ISO 3166-1 numeric → alpha-2, for matching map shapes. */
  numericToIso: Map<number, string>;
}

/** Countries where people usually name the state/province, not the country. */
const REGION_BY_ADMIN1 = new Set(['US', 'CA', 'AU']);

/** Lowercase, strip accents and punctuation so "São Paulo" matches "sao paulo". */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function buildIndex(data: PlacesData): PlaceIndex {
  const countryNames = new Map(data.countries.map(([iso, name]) => [iso, name]));
  const numericToIso = new Map(data.countries.map(([iso, , num]) => [num, iso]));
  const places: Place[] = [];
  const keys: string[] = [];
  data.cities.split('\n').forEach((line, rank) => {
    const [name, a1, ci, lat, lon] = line.split('|');
    const [iso, countryName] = data.countries[Number(ci)] ?? ['', ''];
    places.push({
      name: name!,
      admin1: data.admin1[Number(a1)] ?? '',
      country: iso,
      countryName,
      lat: Number(lat),
      lon: Number(lon),
      rank,
    });
    keys.push(fold(name!));
  });
  return { places, keys, countryNames, numericToIso };
}

let loading: Promise<PlaceIndex> | null = null;

/** Fetches and indexes the dataset once; later calls share the result. */
export function loadPlaces(url = `${import.meta.env.BASE_URL}data/places.json`): Promise<PlaceIndex> {
  loading ??= fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`places.json: HTTP ${res.status}`);
      return res.json() as Promise<PlacesData>;
    })
    .then(buildIndex)
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
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
 * Prefix matches on the whole name first, then on later words
 * ("york" → New York), each group ordered by population.
 */
export function searchPlaces(index: PlaceIndex, query: string, limit = 6): Place[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const starts: Place[] = [];
  const words: Place[] = [];
  for (let i = 0; i < index.keys.length && starts.length < limit; i++) {
    const key = index.keys[i]!;
    if (key.startsWith(q)) starts.push(index.places[i]!);
    else if (words.length < limit && key.includes(` ${q}`)) words.push(index.places[i]!);
  }
  return [...starts, ...words].slice(0, limit);
}

const REGION_ALIASES: Record<string, string> = {
  usa: 'united states',
  us: 'united states',
  'united states of america': 'united states',
  america: 'united states',
  uk: 'united kingdom',
  britain: 'united kingdom',
  'great britain': 'united kingdom',
  england: 'united kingdom',
  scotland: 'united kingdom',
  wales: 'united kingdom',
  'northern ireland': 'united kingdom',
};

/**
 * Best-effort lookup for an entry typed without picking a suggestion.
 * Prefers an exact name whose state/province or country matches the
 * region text; otherwise accepts the name only if it's unambiguous.
 */
export function matchPlace(index: PlaceIndex, city: string, region: string): Place | null {
  const c = fold(city);
  const r = fold(region);
  const country = REGION_ALIASES[r] ?? r;
  const candidates: Place[] = [];
  for (let i = 0; i < index.keys.length; i++) {
    if (index.keys[i] !== c) continue;
    const p = index.places[i]!;
    if (r && (fold(p.admin1) === r || fold(p.countryName) === country || p.country.toLowerCase() === r)) return p;
    candidates.push(p);
  }
  return candidates.length === 1 || (!r && candidates.length) ? candidates[0]! : null;
}
