import { describe, expect, it } from 'vitest';
import { LocalStorageStore } from '../src/data/local-store';
import { makeEntry } from './fixtures';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(k: string) { return this.data.get(k) ?? null; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  removeItem(k: string) { this.data.delete(k); }
  setItem(k: string, v: string) { this.data.set(k, v); }
}

describe('LocalStorageStore', () => {
  it('upserts, lists and removes', async () => {
    const store = new LocalStorageStore(new MemoryStorage());
    await store.upsert(makeEntry({ id: 'a' }));
    await store.upsertMany([makeEntry({ id: 'a', notes: 'edited' }), makeEntry({ id: 'b', city: 'Kyoto' })]);
    expect((await store.list()).map((e) => [e.id, e.notes])).toEqual([['a', 'edited'], ['b', '']]);
    await store.remove('a');
    expect((await store.list()).map((e) => e.id)).toEqual(['b']);
  });

  it('migrates data saved under the Travel Logbook key', async () => {
    const storage = new MemoryStorage();
    storage.setItem('tlb_entries', JSON.stringify([makeEntry({ id: 'old' })]));
    const store = new LocalStorageStore(storage);
    expect((await store.list()).map((e) => e.id)).toEqual(['old']);
  });

  it('survives corrupt storage', async () => {
    const storage = new MemoryStorage();
    storage.setItem('ledger.entries', '{oops');
    expect(await new LocalStorageStore(storage).list()).toEqual([]);
  });
});
