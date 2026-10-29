import { Capacitor } from '@capacitor/core';
import type { Entry } from '../domain/entry';

/** Persistence boundary for ledger entries. */
export interface EntryStore {
  list(): Promise<Entry[]>;
  upsert(entry: Entry): Promise<void>;
  /** Inserts or replaces all entries atomically. */
  upsertMany(entries: readonly Entry[]): Promise<void>;
  remove(id: string): Promise<void>;
}

/**
 * Native builds persist to SQLite; a desktop browser (`npm run dev`) falls
 * back to localStorage so the UI can be iterated on without an APK rebuild.
 * The SQLite module is loaded lazily so it stays out of the web bundle path.
 */
export async function openStore(): Promise<EntryStore> {
  if (Capacitor.isNativePlatform()) {
    const { openSqliteStore } = await import('./sqlite-store');
    return openSqliteStore();
  }
  const { LocalStorageStore } = await import('./local-store');
  return new LocalStorageStore();
}
