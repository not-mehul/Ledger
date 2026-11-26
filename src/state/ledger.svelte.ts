// ============================================================
// App state. Owns the ledger document; every mutation is written
// to disk first and only then becomes visible, so the UI never
// shows data that wasn't saved.
// ============================================================

import { loadDoc, saveDoc } from '../data/doc-store';
import { emptyDoc, type LedgerDoc, type Settings } from '../domain/doc';
import { applyUpserts, mergeImported, nextSavedAt, type Entry } from '../domain/entry';
import { mergeConfig, type MetricConfig } from '../domain/metrics';
import { calcScore } from '../domain/score';
import { mergeEntries, type SyncBase, type SyncMerge } from '../domain/sync-merge';
import type { ParsedImport } from './transfer';

export interface ImportSummary {
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  metricsAdded: number;
}

/** Thrown by `saveEntry` when the entry being updated was deleted meanwhile. */
export class EntryGone extends Error {}

/** Coordinates found for an entry that had none (the map places typed cities). */
export type Placement = Pick<Entry, 'id' | 'country' | 'lat' | 'lon'>;

class LedgerState {
  doc = $state.raw<LedgerDoc>(emptyDoc());
  status = $state<'loading' | 'ready' | 'failed'>('loading');
  /** Where an unreadable ledger was moved on launch, so it can be recovered. Empty normally. */
  setAside = $state.raw<string[]>([]);

  entries = $derived(this.doc.entries);
  config = $derived(this.doc.config);
  settings = $derived(this.doc.settings);
  scores = $derived(new Map(this.doc.entries.map((e) => [e.id, calcScore(e.ratings, this.doc.config)])));

  async init(): Promise<void> {
    try {
      const loaded = await loadDoc();
      if (loaded.doc) this.doc = loaded.doc;
      this.setAside = loaded.setAside;
      this.status = 'ready';
    } catch (err) {
      console.error('Storage failed to initialise:', err);
      this.status = 'failed';
    }
  }

  scoreOf = (entry: Entry): number | null => this.scores.get(entry.id) ?? calcScore(entry.ratings, this.config);

  find(id: string): Entry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();

  /** Called after every saved change to the entries or metrics (not settings). */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Applies `change` to the latest committed document, one change at a
   * time, so quick successive edits can't overwrite each other.
   */
  private mutate<T = void>(change: (doc: LedgerDoc) => Promise<[LedgerDoc, T]> | [LedgerDoc, T]): Promise<T> {
    const run = this.queue
      .catch(() => undefined)
      .then(async () => {
        if (this.status !== 'ready') throw new Error('Storage is unavailable.');
        const previous = this.doc;
        const [next, result] = await change(previous);
        if (next === previous) return result;
        await saveDoc(next);
        this.doc = next;
        if (next.entries !== previous.entries || next.config !== previous.config) {
          for (const listener of this.listeners) listener();
        }
        return result;
      });
    this.queue = run;
    return run;
  }

  /**
   * Saves a new entry, or with `update` replaces an existing one. An update
   * to an entry deleted meanwhile throws EntryGone instead of bringing it back.
   */
  saveEntry(entry: Entry, { update = false }: { update?: boolean } = {}): Promise<void> {
    return this.mutate((doc) => {
      if (update && !doc.entries.some((e) => e.id === entry.id)) throw new EntryGone(entry.id);
      return [{ ...doc, entries: applyUpserts(doc.entries, [entry]) }, undefined];
    });
  }

  /**
   * Adds coordinates to entries that still have none, against the latest
   * document, so a placement worked out from an older copy never replaces
   * an edit, an import or a sync that landed meanwhile.
   */
  placeEntries(placements: readonly Placement[]): Promise<number> {
    return this.mutate((doc) => {
      const found = new Map(placements.map((p) => [p.id, p]));
      let placed = 0;
      const entries = doc.entries.map((e) => {
        const p = found.get(e.id);
        if (!p || e.lat !== undefined) return e;
        placed++;
        return { ...e, country: p.country, lat: p.lat, lon: p.lon };
      });
      return [placed ? { ...doc, entries } : doc, placed];
    });
  }

  /**
   * Puts an entry where you placed it by hand on the map, with the country
   * found there, or with `null` takes its pin away. A save like any edit, so
   * it syncs; it returns the entry as it was, for Undo.
   */
  pinEntry(id: string, pin: { lat: number; lon: number; country?: string } | null): Promise<Entry | undefined> {
    return this.mutate((doc) => {
      const before = doc.entries.find((e) => e.id === id);
      if (!before) throw new EntryGone(id);
      const after: Entry = { ...before, savedAt: nextSavedAt(before.savedAt) };
      delete after.lat;
      delete after.lon;
      if (pin) {
        after.lat = pin.lat;
        after.lon = pin.lon;
        if (pin.country) after.country = pin.country;
        else delete after.country;
      }
      return [{ ...doc, entries: applyUpserts(doc.entries, [after]) }, before];
    });
  }

  /** Removes an entry and returns it, so it can be put back. */
  deleteEntry(id: string): Promise<Entry | undefined> {
    return this.mutate((doc) => [
      { ...doc, entries: doc.entries.filter((e) => e.id !== id) },
      doc.entries.find((e) => e.id === id),
    ]);
  }

  /** Undoes `deleteEntry`. */
  restoreEntry(entry: Entry): Promise<void> {
    return this.mutate((doc) => [{ ...doc, entries: applyUpserts(doc.entries, [entry]) }, undefined]);
  }

  /** `update` receives the current config; throw from it to cancel. */
  updateConfig(update: (config: MetricConfig) => MetricConfig): Promise<void> {
    return this.mutate((doc) => [{ ...doc, config: update(doc.config) }, undefined]);
  }

  updateSettings(patch: Partial<Settings>): Promise<void> {
    return this.mutate((doc) => [{ ...doc, settings: { ...doc.settings, ...patch } }, undefined]);
  }

  /**
   * Folds the sync folder's copy into this one (src/domain/sync-merge.ts),
   * against the latest committed document so an edit made meanwhile isn't lost.
   */
  mergeSynced(remote: ParsedImport, base: SyncBase): Promise<SyncMerge> {
    return this.mutate((doc) => {
      const merge = mergeEntries(doc.entries, remote.entries, base);
      const config = remote.config ? mergeConfig(doc.config, remote.config).config : doc.config;
      return [{ ...doc, config, entries: merge.merged }, merge];
    });
  }

  import(parsed: ParsedImport): Promise<ImportSummary> {
    return this.mutate((doc) => {
      const plan = mergeImported(doc.entries, parsed.entries);
      const merged = parsed.config ? mergeConfig(doc.config, parsed.config) : { config: doc.config, added: 0 };
      return [
        { ...doc, config: merged.config, entries: applyUpserts(doc.entries, plan.toSave) },
        {
          added: plan.added,
          updated: plan.updated,
          unchanged: plan.unchanged,
          skipped: parsed.skipped,
          metricsAdded: merged.added,
        },
      ];
    });
  }
}

export const ledger = new LedgerState();
