// ============================================================
// The continent of every ISO 3166-1 country and territory, from GeoNames'
// countryInfo.txt (CC BY 4.0). Russia and Turkey count as Europe and Asia
// respectively, as GeoNames has them.
// ============================================================

export const CONTINENTS = ['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA'] as const;
export type Continent = (typeof CONTINENTS)[number];

/** Continents people travel to: Antarctica counts only once you've been. */
export const INHABITED_CONTINENTS = 6;

/** UN members and observer states, the usual answer to "how many countries are there". */
export const WORLD_COUNTRIES = 195;

const BY_CONTINENT: Record<Continent, string> = {
  AF: 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW',
  AN: 'AQ BV GS HM TF',
  AS: 'AE AF AM AZ BD BH BN BT CC CN GE HK ID IL IN IO IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TM TR TW UZ VN YE',
  EU: 'AD AL AT AX BA BE BG BY CH CS CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK',
  NA: 'AG AI AN AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PM PR SV SX TC TT US VC VG VI',
  OC: 'AS AU CK CX FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TL TO TV UM VU WF WS',
  SA: 'AR BO BR CL CO EC FK GF GY PE PY SR UY VE',
};

const CONTINENT_OF = new Map<string, Continent>(
  CONTINENTS.flatMap((c) => BY_CONTINENT[c].split(' ').map((code) => [code, c] as const)),
);

/** The continent of a country code, or undefined for one GeoNames doesn't list. */
export function continentOf(country: string): Continent | undefined {
  return CONTINENT_OF.get(country);
}
