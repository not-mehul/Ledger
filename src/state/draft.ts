// ============================================================
// The entry form's work in progress, kept in the WebView's storage on the
// phone, so an entry half-rated when Android closes Ledger in the background
// is there when you come back. One draft at most; it's cleared on save or
// Clear. Never synced or backed up.
// ============================================================

import { normalizeMonth } from '../lib/dates';

const KEY = 'ledger.entryDraft';

export interface Draft {
  city: string;
  region: string;
  month: string;
  notes: string;
  ratings: Record<string, number>;
  skipped: string[];
  located: { country?: string; lat?: number; lon?: number };
  pristine: boolean;
  editingId: string | null;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** The saved draft, or null when there is none or it can't be read. */
export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Record<string, unknown>;
    const month = normalizeMonth(str(d.month));
    if (!month) return null;
    const ratings: Record<string, number> = {};
    if (d.ratings && typeof d.ratings === 'object') {
      for (const [id, v] of Object.entries(d.ratings)) if (num(v) !== undefined) ratings[id] = v as number;
    }
    const loc = (d.located && typeof d.located === 'object' ? d.located : {}) as Record<string, unknown>;
    const located = Object.fromEntries(
      Object.entries({ country: str(loc.country) || undefined, lat: num(loc.lat), lon: num(loc.lon) }).filter(([, v]) => v !== undefined),
    );
    return {
      city: str(d.city),
      region: str(d.region),
      month,
      notes: str(d.notes),
      ratings,
      skipped: Array.isArray(d.skipped) ? d.skipped.filter((x): x is string => typeof x === 'string') : [],
      located,
      pristine: d.pristine === true,
      editingId: typeof d.editingId === 'string' ? d.editingId : null,
    };
  } catch {
    return null;
  }
}

export function writeDraft(draft: Draft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage full or unavailable: the form still works, it just won't come back.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
