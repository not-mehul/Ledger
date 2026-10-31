// Builds public/data/places.json — the offline city list behind city
// autocomplete and the map — from GeoNames (https://www.geonames.org/,
// CC BY 4.0). Cities with a population of 15,000 or more are included.
//
//   npm run places                    # download from GeoNames
//   GEONAMES_DIR=./dump npm run places   # use already-downloaded files
//
// Output (compact, parsed by src/lib/places.ts):
//   { v, attribution, countries: [[iso2, name, isoNumeric]], admin1: [name],
//     cities: "name|admin1Index|countryIndex|lat|lon\n…" }  (most populous first)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

const BASE = 'https://download.geonames.org/export/dump/';
const out = fileURLToPath(new URL('../public/data/places.json', import.meta.url));

async function source(name) {
  if (process.env.GEONAMES_DIR) {
    return new Uint8Array(await readFile(`${process.env.GEONAMES_DIR}/${name}`));
  }
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

const rows = (text) =>
  text
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('\t'));

const citiesText = strFromU8(unzipSync(await source('cities15000.zip'))['cities15000.txt']);
const admin1Text = strFromU8(await source('admin1CodesASCII.txt'));
const countryText = strFromU8(await source('countryInfo.txt'));

// countryInfo.txt: ISO, ISO3, ISO-Numeric, fips, Country, …
const countries = rows(countryText).map((c) => [c[0], c[4], Number(c[2])]);
const countryIndex = new Map(countries.map((c, i) => [c[0], i]));

// admin1CodesASCII.txt: "US.TX", name, asciiname, geonameid
const admin1Names = new Map(rows(admin1Text).map((a) => [a[0], a[1]]));
const admin1 = [''];
const admin1Index = new Map([['', 0]]);

const cities = [];
for (const c of rows(citiesText)) {
  // geonameid, name, asciiname, alternatenames, lat, lon, fclass, fcode, cc, cc2, admin1, …, population
  const cc = c[8];
  if (!countryIndex.has(cc)) continue;
  const a1 = admin1Names.get(`${cc}.${c[10]}`) ?? '';
  if (!admin1Index.has(a1)) {
    admin1Index.set(a1, admin1.length);
    admin1.push(a1);
  }
  const pop = Number(c[14]) || 0;
  cities.push({ line: [c[1].replaceAll('|', ' '), admin1Index.get(a1), countryIndex.get(cc), Number(c[4]).toFixed(2), Number(c[5]).toFixed(2)].join('|'), pop });
}
cities.sort((a, b) => b.pop - a.pop);

const data = {
  v: 1,
  attribution: 'GeoNames (geonames.org), CC BY 4.0',
  countries,
  admin1,
  cities: cities.map((c) => c.line).join('\n'),
};

await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(out, JSON.stringify(data));
console.log(`${cities.length} cities, ${countries.length} countries → ${out}`);
