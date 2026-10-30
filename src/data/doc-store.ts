// Persists the whole ledger as one JSON document.
//
// Writes go to a temporary file that is then renamed over the real one,
// so a crash mid-write never leaves a truncated ledger.json. (The
// plugin's rename deletes the target first; if the app dies in that
// instant the temp file is the newest copy, and `loadDoc` falls back
// to it.) Saves are serialised so an older document can never
// overwrite a newer one.

import { migrate, type LedgerDoc } from '../domain/doc';
import { readText, rename, writeText } from './files';

const FILE = 'ledger.json';
const TEMP = 'ledger.json.tmp';
/** Browser-only keys from Travel Logbook and early Ledger dev builds. */
const LEGACY_KEYS = ['ledger.entries', 'tlb_entries'];

export async function loadDoc(): Promise<LedgerDoc | null> {
  for (const path of [FILE, TEMP]) {
    try {
      return migrate(JSON.parse(await readText(path)));
    } catch {
      // Missing or unreadable — try the next candidate.
    }
  }
  for (const key of LEGACY_KEYS) {
    const legacy = globalThis.localStorage?.getItem(key);
    if (!legacy) continue;
    try {
      return migrate(JSON.parse(legacy));
    } catch {
      // Ignore corrupt legacy data.
    }
  }
  return null;
}

let queue: Promise<void> = Promise.resolve();

export function saveDoc(doc: LedgerDoc): Promise<void> {
  const json = JSON.stringify(doc);
  const run = queue
    .catch(() => undefined)
    .then(async () => {
      await writeText(TEMP, json);
      await rename(TEMP, FILE);
    });
  queue = run;
  return run;
}
