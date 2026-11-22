// The stateful layer with storage in memory: loading, the mutation queue and sync scheduling.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const disk = new Map<string, string>();
/** Paths whose reads fail this many more times. */
const failReads = new Map<string, number>();

vi.mock('../../src/data/files', () => ({
  readText: async (p: string) => {
    const left = failReads.get(p) ?? 0;
    if (left > 0) {
      failReads.set(p, left - 1);
      throw new Error('EIO');
    }
    const v = disk.get(p);
    if (v === undefined) throw new Error('File does not exist');
    return v;
  },
  writeText: async (p: string, t: string) => void disk.set(p, t),
  rename: async (a: string, b: string) => {
    if (!disk.has(a)) throw new Error('missing');
    disk.set(b, disk.get(a)!);
    disk.delete(a);
  },
  exists: async (p: string) => disk.has(p),
}));

import { makeEntry } from './fixtures';

const stored = (entries: unknown[], extra: object = {}) => JSON.stringify({ schemaVersion: 2, entries, ...extra });

async function freshLedger() {
  vi.resetModules();
  const { ledger, EntryGone } = await import('../../src/state/ledger.svelte');
  await ledger.init();
  return { ledger, EntryGone };
}

beforeEach(() => {
  disk.clear();
  failReads.clear();
});

describe('loading the ledger', () => {
  it('H1: a one-off read error is retried', async () => {
    disk.set('ledger.json', stored([makeEntry()]));
    failReads.set('ledger.json', 1);
    const { ledger } = await freshLedger();
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.setAside).toEqual([]);
  });

  it('H1: an unreadable ledger is moved aside, never overwritten', async () => {
    disk.set('ledger.json', '{"schemaVersion":2,"entries":[{"city":"Lis');
    const { ledger } = await freshLedger();
    expect(ledger.status).toBe('ready');
    expect(ledger.entries).toHaveLength(0);
    expect(ledger.setAside).toHaveLength(1);
    const aside = ledger.setAside[0]!;
    expect(aside).toMatch(/^ledger\.unreadable-.+\.json$/);
    await ledger.updateSettings({ theme: 'light' });
    expect(disk.get(aside)).toBe('{"schemaVersion":2,"entries":[{"city":"Lis');
  });

  it('H1: a ledger from a newer version is kept, not downgraded', async () => {
    disk.set('ledger.json', JSON.stringify({ schemaVersion: 99, entries: [], future: true }));
    const { ledger } = await freshLedger();
    expect(ledger.setAside).toHaveLength(1);
    expect(JSON.parse(disk.get(ledger.setAside[0]!)!).future).toBe(true);
  });

  it('H1: falls back to the temp file when the ledger is unreadable', async () => {
    disk.set('ledger.json', 'garbage');
    disk.set('ledger.json.tmp', stored([makeEntry()]));
    const { ledger } = await freshLedger();
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.setAside).toHaveLength(1);
  });

  it('H1: a missing ledger is a new one, with nothing set aside', async () => {
    const { ledger } = await freshLedger();
    expect(ledger.status).toBe('ready');
    expect(ledger.setAside).toEqual([]);
  });
});

describe('editing', () => {
  it('M2: placing entries on the map never overwrites a queued edit', async () => {
    disk.set('ledger.json', stored([makeEntry({ notes: 'old' })]));
    const { ledger } = await freshLedger();
    const [entry] = ledger.entries;
    const edit = ledger.saveEntry({ ...entry!, notes: 'new edit', savedAt: new Date().toISOString() }, { update: true });
    const placed = ledger.placeEntries([{ id: entry!.id, country: 'US', lat: 30, lon: -97 }]);
    await Promise.all([edit, placed]);
    expect(ledger.entries[0]).toMatchObject({ notes: 'new edit', lat: 30, lon: -97, country: 'US' });
  });

  it('M2: placing skips entries that already have coordinates', async () => {
    disk.set('ledger.json', stored([makeEntry({ lat: 1, lon: 2 })]));
    const { ledger } = await freshLedger();
    expect(await ledger.placeEntries([{ id: 'e1', lat: 30, lon: -97 }])).toBe(0);
    expect(ledger.entries[0]).toMatchObject({ lat: 1, lon: 2 });
  });

  it('M6: updating an entry deleted meanwhile is refused', async () => {
    disk.set('ledger.json', stored([makeEntry()]));
    const { ledger, EntryGone } = await freshLedger();
    const loadedInForm = ledger.entries[0]!;
    await ledger.deleteEntry(loadedInForm.id);
    await expect(ledger.saveEntry({ ...loadedInForm }, { update: true })).rejects.toBeInstanceOf(EntryGone);
    expect(ledger.entries).toHaveLength(0);
  });
});

describe('folder sync scheduling', () => {
  it('M4: a change made while a sync runs is pushed when it ends', async () => {
    vi.useFakeTimers();
    try {
      disk.set('ledger.json', stored([], { settings: { syncFolder: { uri: 'content://x', name: 'x' } } }));
      const { ledger } = await freshLedger();
      let finishWrite: (() => void) | undefined;
      const writes: string[] = [];
      const io = {
        pick: async () => ({}),
        release: async () => undefined,
        read: async (): Promise<{ data?: string }> => ({}),
        write: ({ data }: { data: string }) =>
          new Promise<{ modified?: number }>((resolve) => {
            writes.push(data);
            finishWrite = () => resolve({ modified: writes.length });
          }),
      };
      const { FolderSyncState } = await import('../../src/state/sync.svelte');
      const sync = new FolderSyncState(io);
      const first = sync.now();
      await vi.waitFor(() => expect(finishWrite).toBeDefined());
      // The folder write is in flight, holding the ledger as it was; an entry is saved now.
      await ledger.saveEntry(makeEntry());
      sync.soon(); // what main.ts does after every change; ignored while busy
      finishWrite!();
      await first;
      finishWrite = undefined;
      await vi.advanceTimersByTimeAsync(5_000);
      await vi.waitFor(() => expect(finishWrite).toBeDefined());
      finishWrite!();
      expect(writes).toHaveLength(2);
      expect(writes[1]).not.toBe(writes[0]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('M3: a failed sync is remembered until one succeeds', async () => {
    disk.set('ledger.json', stored([], { settings: { syncFolder: { uri: 'content://x', name: 'x' } } }));
    await freshLedger();
    const io = {
      pick: async () => ({}),
      release: async () => undefined,
      read: async (): Promise<{ data?: string }> => {
        throw new Error('The sync file is too large');
      },
      write: async () => ({ modified: 1 }),
    };
    const { FolderSyncState } = await import('../../src/state/sync.svelte');
    const sync = new FolderSyncState(io);
    expect(await sync.now()).toBe('failed');
    expect(sync.failedAt).not.toBeNull();
    io.read = async () => ({});
    expect(await sync.now()).toBe('synced');
    expect(sync.failedAt).toBeNull();
  });
});
