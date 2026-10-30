// ============================================================
// App state. Owns the ledger document; every mutation is written
// to disk first and only then becomes visible, so the UI never
// shows data that wasn't saved.
// ============================================================

import { loadDoc, saveDoc } from '../data/doc-store';
import { collectGarbage, deletePhoto, writePhotoFiles } from '../data/photo-store';
import { emptyDoc, type LedgerDoc, type Settings } from '../domain/doc';
import { applyUpserts, mergeImported, type Entry } from '../domain/entry';
import { mergeConfig, type MetricConfig } from '../domain/metrics';
import { calcScore } from '../domain/score';
import type { PhotoFiles } from '../lib/backup';
import type { ParsedImport } from '../lib/markdown';

export interface ImportSummary {
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  metricsAdded: number;
}

class LedgerState {
  doc = $state.raw<LedgerDoc>(emptyDoc());
  status = $state<'loading' | 'ready' | 'failed'>('loading');

  entries = $derived(this.doc.entries);
  config = $derived(this.doc.config);
  settings = $derived(this.doc.settings);
  scores = $derived(new Map(this.doc.entries.map((e) => [e.id, calcScore(e.ratings, this.doc.config)])));

  async init(): Promise<void> {
    try {
      const loaded = await loadDoc();
      if (loaded) this.doc = loaded;
      this.status = 'ready';
      void collectGarbage(new Set(this.doc.entries.flatMap((e) => e.photos.map((p) => p.id)))).catch(() => 0);
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

  /**
   * Applies `change` to the latest committed document, one change at a
   * time, so quick successive edits can't overwrite each other.
   */
  private mutate<T = void>(change: (doc: LedgerDoc) => Promise<[LedgerDoc, T]> | [LedgerDoc, T]): Promise<T> {
    const run = this.queue
      .catch(() => undefined)
      .then(async () => {
        if (this.status !== 'ready') throw new Error('Storage is unavailable.');
        const [next, result] = await change(this.doc);
        await saveDoc(next);
        this.doc = next;
        return result;
      });
    this.queue = run;
    return run;
  }

  async saveEntry(entry: Entry): Promise<void> {
    const previous = await this.mutate((doc) => [
      { ...doc, entries: applyUpserts(doc.entries, [entry]) },
      doc.entries.find((e) => e.id === entry.id),
    ]);
    // Photos removed while editing are no longer referenced.
    const kept = new Set(entry.photos.map((p) => p.id));
    for (const p of previous?.photos ?? []) if (!kept.has(p.id)) void deletePhoto(p.id);
  }

  saveEntries(entries: readonly Entry[]): Promise<void> {
    return this.mutate((doc) => [{ ...doc, entries: applyUpserts(doc.entries, entries) }, undefined]);
  }

  async deleteEntry(id: string): Promise<void> {
    const removed = await this.mutate((doc) => [
      { ...doc, entries: doc.entries.filter((e) => e.id !== id) },
      doc.entries.find((e) => e.id === id),
    ]);
    for (const p of removed?.photos ?? []) void deletePhoto(p.id);
  }

  /** `update` receives the current config; throw from it to cancel. */
  updateConfig(update: (config: MetricConfig) => MetricConfig): Promise<void> {
    return this.mutate((doc) => [{ ...doc, config: update(doc.config) }, undefined]);
  }

  updateSettings(patch: Partial<Settings>): Promise<void> {
    return this.mutate((doc) => [{ ...doc, settings: { ...doc.settings, ...patch } }, undefined]);
  }

  import(parsed: ParsedImport, photos?: PhotoFiles): Promise<ImportSummary> {
    return this.mutate(async (doc) => {
      const plan = mergeImported(doc.entries, parsed.entries);
      const merged = parsed.config ? mergeConfig(doc.config, parsed.config) : { config: doc.config, added: 0 };
      if (photos?.size) {
        const wanted = new Set(plan.toSave.flatMap((e) => e.photos.map((p) => p.id)));
        await writePhotoFiles(new Map([...photos].filter(([name]) => wanted.has(name.replace(/(_t)?\.jpg$/, '')))));
      }
      // Imports without photo files (Markdown, JSON) can't bring photos; keep
      // whatever the local copy already has instead of dangling references.
      const local = new Map(doc.entries.map((e) => [e.id, e]));
      const toSave = photos ? plan.toSave : plan.toSave.map((e) => ({ ...e, photos: local.get(e.id)?.photos ?? [] }));
      return [
        { ...doc, config: merged.config, entries: applyUpserts(doc.entries, toSave) },
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
