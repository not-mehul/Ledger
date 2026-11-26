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

describe('backup to a folder', () => {
  const folder = { syncFolder: { uri: 'content://x', name: 'Drive' } };
  const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');
  const unb64 = (data: string) => Buffer.from(data, 'base64').toString('utf8');
  type Read = { data?: string; modified?: number };

  async function setUp(files: Record<string, string> = {}, settings: object = folder) {
    disk.set('ledger.json', stored([makeEntry({ id: 'mine', city: 'Lisbon', state: 'Portugal' })], { settings }));
    const { ledger } = await freshLedger();
    const written: Record<string, string> = {};
    const io = {
      pick: async () => ({ uri: 'content://y', name: 'Nextcloud' }),
      release: async () => undefined,
      read: async ({ file }: { file: string }): Promise<Read> => (files[file] ? { data: files[file], modified: 5 } : {}),
      write: async ({ file, data }: { file: string; data: string }) => {
        written[file] = data;
        return { modified: 6 };
      },
    };
    const { BackupState, BACKUP_FILE, LEGACY_FILE } = await import('../../src/state/backup.svelte');
    return { ledger, io, written, backup: new BackupState(io), BACKUP_FILE, LEGACY_FILE };
  }

  it('writes ledger-backup.json and brings in what another phone backed up', async () => {
    const theirs = makeEntry({ id: 'theirs', city: 'Kyoto', state: 'Japan' });
    const { ledger, backup, written, BACKUP_FILE } = await setUp({
      'ledger-backup.json': b64(JSON.stringify({ app: 'ledger', schemaVersion: 2, entries: [theirs] })),
    });
    expect(await backup.now()).toEqual({ brought: 1 });
    expect(ledger.entries.map((e) => e.id).sort()).toEqual(['mine', 'theirs']);
    const file = JSON.parse(unb64(written[BACKUP_FILE]!)) as { entries: { id: string }[] };
    expect(file.entries.map((e) => e.id).sort()).toEqual(['mine', 'theirs']);
    expect(ledger.settings.lastBackupAt).toBeDefined();
    expect(ledger.settings.syncBase).toMatchObject({ mine: expect.any(String), theirs: expect.any(String) });
  });

  it('reads a folder set up before 2.1 from its zip, then writes the .json', async () => {
    const { zipSync, strToU8 } = await import('fflate');
    const old = makeEntry({ id: 'old', city: 'Porto', state: 'Portugal' });
    const zip = zipSync({ 'ledger.json': strToU8(JSON.stringify({ schemaVersion: 2, entries: [old] })) });
    const { ledger, backup, written, BACKUP_FILE, LEGACY_FILE } = await setUp({ 'Ledger sync.zip': Buffer.from(zip).toString('base64') });
    expect(await backup.now()).toEqual({ brought: 1 });
    expect(ledger.find('old')).toBeDefined();
    expect(written[BACKUP_FILE]).toBeDefined();
    expect(written[LEGACY_FILE]).toBeUndefined();
  });

  it('backs up when due, never before, and only with a folder', async () => {
    const { ledger, backup, written, BACKUP_FILE } = await setUp();
    await backup.ifDue();
    expect(written[BACKUP_FILE]).toBeDefined();
    delete written[BACKUP_FILE];
    await backup.ifDue(); // daily, and it just ran
    expect(written[BACKUP_FILE]).toBeUndefined();
    await ledger.updateSettings({ autoBackup: 'off', lastBackupAt: undefined });
    await backup.ifDue();
    expect(written[BACKUP_FILE]).toBeUndefined();
    await ledger.updateSettings({ autoBackup: 'daily' });
    await backup.stop();
    await backup.ifDue();
    expect(written[BACKUP_FILE]).toBeUndefined();
    expect(ledger.settings.syncFolder).toBeUndefined();
  });

  it('remembers a failed backup until one succeeds, and ifDue never throws', async () => {
    const { ledger, backup, io } = await setUp();
    io.read = async () => {
      throw new Error('The backup file is too large');
    };
    await expect(backup.now()).rejects.toThrow('too large');
    expect(ledger.settings.backupFailedAt).toBeDefined();
    await expect(backup.ifDue()).resolves.toBeUndefined();
    io.read = async () => ({});
    await backup.now();
    expect(ledger.settings.backupFailedAt).toBeUndefined();
  });

  it('a new folder starts fresh: nothing known, nothing counted as deleted', async () => {
    const { ledger, backup } = await setUp({}, { ...folder, syncBase: { gone: '2025-01-01T00:00:00Z' }, lastBackupAt: '2026-01-01T00:00:00Z' });
    expect(await backup.choose()).toBe(true);
    expect(ledger.settings.syncFolder).toEqual({ uri: 'content://y', name: 'Nextcloud' });
    expect(ledger.settings.syncBase).toEqual({});
    expect(ledger.settings.lastBackupAt).toBeUndefined();
  });
});
