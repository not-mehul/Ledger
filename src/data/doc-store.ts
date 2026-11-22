// Persists the whole ledger as one JSON document.
//
// Writes go to a temporary file that is then renamed over the real one,
// so a crash mid-write never leaves a truncated ledger.json. (The
// plugin's rename deletes the target first; if the app dies in that
// instant the temp file is the newest copy, and `loadDoc` falls back
// to it.) Saves are serialised so an older document can never
// overwrite a newer one.
//
// A ledger that is there but can't be read is never overwritten: it is
// renamed aside (ledger.unreadable-<time>.json) before the app starts
// afresh, so it can still be recovered by hand.

import { SCHEMA_VERSION, migrate, type LedgerDoc } from '../domain/doc';
import { exists, readText, rename, writeText } from './files';

const FILE = 'ledger.json';
const TEMP = 'ledger.json.tmp';

export interface Loaded {
  /** The ledger, or null to start a new one. */
  doc: LedgerDoc | null;
  /** File names an unreadable ledger was moved to, if any. */
  setAside: string[];
}

type Read = LedgerDoc | 'missing' | 'unreadable';

function parse(text: string): LedgerDoc {
  const raw: unknown = JSON.parse(text);
  // A ledger written by a newer version would lose what this one doesn't know.
  const version = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof version === 'number' && version > SCHEMA_VERSION) throw new Error(`Schema ${version} is newer than ${SCHEMA_VERSION}`);
  return migrate(raw);
}

/** Reads one candidate, trying twice so a one-off read error doesn't count as damage. */
async function read(path: string): Promise<Read> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return parse(await readText(path));
    } catch {
      // Missing, unreadable or not a ledger: try again, then tell which.
    }
  }
  return (await exists(path)) ? 'unreadable' : 'missing';
}

function asideName(now = new Date()): string {
  return `ledger.unreadable-${now.toISOString().replace(/[:.]/g, '-')}.json`;
}

async function setAside(path: string, aside: string[]): Promise<void> {
  const name = asideName();
  const target = aside.length ? name.replace('.json', `-${aside.length + 1}.json`) : name;
  await rename(path, target);
  aside.push(target);
}

export async function loadDoc(): Promise<Loaded> {
  const aside: string[] = [];
  const main = await read(FILE);
  if (typeof main === 'object') return { doc: main, setAside: aside };
  const temp = await read(TEMP);
  // Move anything unreadable out of the way before a save could replace it.
  if (main === 'unreadable') await setAside(FILE, aside);
  if (typeof temp === 'object') return { doc: temp, setAside: aside };
  if (temp === 'unreadable') await setAside(TEMP, aside);
  return { doc: null, setAside: aside };
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
