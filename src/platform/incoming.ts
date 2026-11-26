// ============================================================
// ledger:// links from the sibling apps (style.md §14.1).
//   ledger://add?city=Lisbon&region=Portugal&country=PT&date=2026-10-02&source=waymark
//     starts a new entry with the place and month filled in. The person
//     rates and saves it; a link never saves anything itself.
//   ledger://open, and any action Ledger doesn't know, just open the app.
// And two of Ledger's own, not part of the suite's scheme:
//   ledger://new, from the "Rate a city" shortcut and the widget, opens the
//     Entry tab as it is (a draft stays).
//   ledger://share?text=…&subject=…, made by MainActivity.java from text
//     shared to Ledger (a place from Maps, an address), starts an entry for
//     the town it names.
// Android registers the scheme with a VIEW intent filter and iOS with
// CFBundleURLTypes; both arrive through appUrlOpen.
// ============================================================

import { App } from '@capacitor/app';
import { normalizeMonth } from '../lib/dates';
import { dateParam, parseLink } from './links';

export interface EntryPrefill {
  city: string;
  /** State, region or country as the sender wrote it ('' when only the code is known). */
  region: string;
  /** ISO 3166-1 alpha-2, upper-case. */
  country?: string;
  /** "YYYY-MM", or null to keep the form's month. */
  month: string | null;
}

/** Text shared to Ledger from another app, to find a town in. */
export interface SharedText {
  shared: string;
}

const MAX_SHARED = 2000;

/**
 * What a ledger:// link asks for: a new entry filled in, the Entry tab, a
 * town in shared text, just opening, or null for no ledger link.
 */
export function readLedgerLink(url: string): EntryPrefill | SharedText | 'new' | 'open' | null {
  const link = parseLink(url, 'ledger');
  if (!link) return null;
  if (link.action === 'new') return 'new';
  if (link.action === 'share') {
    const shared = [link.params.subject, link.params.text].filter(Boolean).join('\n').slice(0, MAX_SHARED).trim();
    return shared ? { shared } : 'new';
  }
  const { city = '', region = '', country = '', date = '' } = link.params;
  if (link.action !== 'add' || !city) return 'open';
  const day = dateParam(date);
  const month = day ? day.slice(0, 7) : normalizeMonth(date);
  return {
    city: city.slice(0, 120),
    region: region.slice(0, 120),
    country: /^[a-z]{2}$/i.test(country) ? country.toUpperCase() : undefined,
    month,
  };
}

export interface LinkHandlers {
  add: (prefill: EntryPrefill) => void;
  entry: () => void;
  share: (text: string) => void;
}

/** Handles the link Ledger was launched with, and each one after. */
export async function listenForLinks(on: LinkHandlers): Promise<void> {
  const handle = (url: string | undefined) => {
    const read = url ? readLedgerLink(url) : null;
    if (!read || read === 'open') return;
    if (read === 'new') on.entry();
    else if ('shared' in read) on.share(read.shared);
    else on.add(read);
  };
  // The end-to-end tests run in a browser, where no app can send a link:
  // under automation only, the same handling is reachable from the page.
  if (navigator.webdriver) (globalThis as { __ledgerLink?: typeof handle }).__ledgerLink = handle;
  await App.addListener('appUrlOpen', (event) => handle(event.url));
  const launch = await App.getLaunchUrl().catch(() => undefined);
  handle(launch?.url);
}
