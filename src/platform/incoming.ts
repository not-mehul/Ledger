// ============================================================
// ledger:// links from the sibling apps (style.md §14.1).
//   ledger://add?city=Lisbon&region=Portugal&country=PT&date=2026-10-02&source=waymark
//     starts a new entry with the place and month filled in. The person
//     rates and saves it; a link never saves anything itself.
//   ledger://open, and any action Ledger doesn't know, just open the app.
// Android registers the scheme with a VIEW intent filter and iOS with
// CFBundleURLTypes; both arrive through appUrlOpen.
// ============================================================

import { App } from '@capacitor/app';
import { normalizeMonth } from '../lib/dates';
import { dateParam, parseLink } from './links';
import { isNative } from './output';

export interface EntryPrefill {
  city: string;
  /** State, region or country as the sender wrote it ('' when only the code is known). */
  region: string;
  /** ISO 3166-1 alpha-2, upper-case. */
  country?: string;
  /** "YYYY-MM", or null to keep the form's month. */
  month: string | null;
}

/** What a ledger:// link asks for: a new entry, just opening, or null for no ledger link. */
export function readLedgerLink(url: string): EntryPrefill | 'open' | null {
  const link = parseLink(url, 'ledger');
  if (!link) return null;
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

/** Calls `onAdd` for the link Ledger was launched with, and for each one after. */
export async function listenForLinks(onAdd: (prefill: EntryPrefill) => void): Promise<void> {
  if (!isNative) return;
  const handle = (url: string | undefined) => {
    const read = url ? readLedgerLink(url) : null;
    if (read && read !== 'open') onAdd(read);
  };
  await App.addListener('appUrlOpen', (event) => handle(event.url));
  const launch = await App.getLaunchUrl().catch(() => undefined);
  handle(launch?.url);
}
