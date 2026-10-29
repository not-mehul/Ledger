import { normalizeEntry, type Entry } from '../domain/entry';
import type { EntryStore } from './store';

const STORAGE_KEY = 'ledger.entries';
/** Key used by Travel Logbook, the app's former name. */
const LEGACY_STORAGE_KEY = 'tlb_entries';

/** Browser-only store used by `npm run dev`. */
export class LocalStorageStore implements EntryStore {
  constructor(private readonly storage: Storage = localStorage) {
    if (storage.getItem(STORAGE_KEY) === null) {
      const legacy = storage.getItem(LEGACY_STORAGE_KEY);
      if (legacy !== null) storage.setItem(STORAGE_KEY, legacy);
    }
  }

  private read(): Entry[] {
    try {
      const parsed: unknown = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeEntry).filter((e): e is Entry => e !== null);
    } catch {
      return [];
    }
  }

  private write(entries: readonly Entry[]): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  list(): Promise<Entry[]> {
    return Promise.resolve(this.read());
  }

  upsert(entry: Entry): Promise<void> {
    return this.upsertMany([entry]);
  }

  upsertMany(entries: readonly Entry[]): Promise<void> {
    const byId = new Map(this.read().map((e) => [e.id, e]));
    for (const e of entries) byId.set(e.id, e);
    this.write([...byId.values()]);
    return Promise.resolve();
  }

  remove(id: string): Promise<void> {
    this.write(this.read().filter((e) => e.id !== id));
    return Promise.resolve();
  }
}
