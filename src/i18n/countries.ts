// Country names from ISO codes, in the reader's language (Intl.DisplayNames).

import { locale } from './index.svelte';

const regionNameCache = new Map<string, Intl.DisplayNames>();
function regionNamesIn(lang: string): Intl.DisplayNames | null {
  let names = regionNameCache.get(lang);
  if (!names) {
    try {
      names = new Intl.DisplayNames([lang], { type: 'region' });
    } catch {
      return null;
    }
    regionNameCache.set(lang, names);
  }
  return names;
}

/** A country's name in the current language, from its ISO code ("PT" → "Portugal"). */
export function countryName(code: string): string {
  try {
    return regionNamesIn(locale())?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** A country's names to search by: in the current language and in English. */
export function countrySearchNames(code: string): string[] {
  const out = new Set<string>();
  for (const lang of [locale(), 'en']) {
    try {
      const name = regionNamesIn(lang)?.of(code);
      if (name && name !== code) out.add(name);
    } catch {
      // An unknown code has no name.
    }
  }
  return [...out];
}
