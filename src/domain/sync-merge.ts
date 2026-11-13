// ============================================================
// Folder sync: merging the folder's copy of the ledger with this
// phone's. Each entry carries `savedAt`, so an entry on both sides
// keeps whichever copy was saved last. What the folder held after the
// last sync (`base`: id → savedAt) tells a deletion from a new entry:
// an entry missing on one side that was there last time was deleted
// there, so it goes; one that wasn't is new, so it stays.
// ============================================================

import type { Entry } from './entry';

/** What the folder held after the last sync: entry id → its savedAt. */
export type SyncBase = Record<string, string>;

export interface SyncMerge {
  /** This phone's entries after the merge. */
  merged: Entry[];
  /** Entries to save here: new from the folder, or newer there. */
  incoming: Entry[];
  /** Ids to delete here: deleted on another phone since the last sync. */
  removed: string[];
  /** The base to keep for next time: exactly what is about to be written to the folder. */
  base: SyncBase;
}

const time = (e: Entry) => Date.parse(e.savedAt) || 0;

export function baseOf(entries: readonly Entry[]): SyncBase {
  return Object.fromEntries(entries.map((e) => [e.id, e.savedAt]));
}

export function mergeEntries(local: readonly Entry[], remote: readonly Entry[], base: SyncBase = {}): SyncMerge {
  const mine = new Map(local.map((e) => [e.id, e]));
  const theirs = new Map(remote.map((e) => [e.id, e]));
  const merged: Entry[] = [];
  const incoming: Entry[] = [];
  const removed: string[] = [];

  for (const [id, here] of mine) {
    const there = theirs.get(id);
    if (there) {
      if (time(there) > time(here)) {
        merged.push(there);
        incoming.push(there);
      } else merged.push(here);
    } else if (id in base && base[id] === here.savedAt) {
      // In the folder last time, unchanged here since, and gone now: deleted on another phone.
      removed.push(id);
    } else {
      // New here, or edited here after another phone deleted it: an edit outweighs a deletion.
      merged.push(here);
    }
  }
  for (const [id, there] of theirs) {
    if (mine.has(id)) continue;
    // Deleted here since the last sync, unless another phone edited it since.
    if (id in base && base[id] === there.savedAt) continue;
    merged.push(there);
    incoming.push(there);
  }
  return { merged, incoming, removed, base: baseOf(merged) };
}
