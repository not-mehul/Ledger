// ============================================================
// Folder sync: merging the folder's copy of the ledger with this
// phone's. Each entry carries `savedAt`, so an entry on both sides
// keeps whichever copy was saved last. What the folder held after the
// last sync (`base`: id → savedAt) tells a deletion from a new entry:
// an entry missing on one side that was there last time was deleted
// there, so it goes; one that wasn't is new, so it stays. The same visit
// (city, region, month) logged separately on two phones is folded into
// one entry, as an import would: the copy saved last wins.
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
/** The same key `isSameVisit` compares on (src/domain/entry.ts). */
const visitKey = (e: Entry) => `${e.city.toLowerCase()}|${e.state.toLowerCase()}|${e.date}`;

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
  const folded = foldVisits(merged);
  const kept = new Set(folded);
  for (const e of merged) if (!kept.has(e) && mine.has(e.id)) removed.push(e.id);
  return {
    merged: folded,
    incoming: incoming.filter((e) => kept.has(e)),
    removed,
    base: baseOf(folded),
  };
}

/**
 * One entry per visit: where two ids record the same city, region and month,
 * the copy saved last stays (ties: the smaller id, so every phone keeps the same one).
 */
function foldVisits(entries: readonly Entry[]): Entry[] {
  const kept = new Map<string, Entry>();
  for (const e of entries) {
    const key = visitKey(e);
    const k = kept.get(key);
    if (!k || time(e) > time(k) || (time(e) === time(k) && e.id < k.id)) kept.set(key, e);
  }
  const winners = new Set(kept.values());
  // In the original order, so the merge doesn't reshuffle the ledger.
  return entries.filter((e) => winners.has(e));
}
