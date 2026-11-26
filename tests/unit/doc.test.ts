import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, emptyDoc, migrate, normalizeSettings } from '../../src/domain/doc';
import { defaultConfig } from '../../src/domain/metrics';
import { makeEntry } from './fixtures';

describe('migrate', () => {
  it('upgrades a v1 bare entry array (Travel Logbook)', () => {
    const doc = migrate([{ ...makeEntry({ id: 'old' }), score: 70 }, { junk: true }]);
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(doc.config).toEqual(defaultConfig());
    expect(doc.entries.map((e) => e.id)).toEqual(['old']);
  });

  it('reads a v2 document and drops duplicate ids', () => {
    const raw = { schemaVersion: 2, config: defaultConfig(), entries: [makeEntry(), makeEntry()], settings: { theme: 'light' } };
    const doc = migrate(raw);
    expect(doc.entries).toHaveLength(1);
    expect(doc.settings.theme).toBe('light');
  });

  it('returns an empty document for garbage', () => {
    expect(migrate('nope')).toEqual(emptyDoc());
  });
});

describe('normalizeSettings', () => {
  it('fills defaults and rejects bad values', () => {
    expect(normalizeSettings({ theme: 'neon', autoBackup: 'hourly', lastBackupAt: 'x' })).toEqual({ theme: 'system', autoBackup: 'daily' });
  });

  it('drops what Ledger no longer has, and keeps a folder set up as sync', () => {
    const old = {
      theme: 'dark',
      language: 'fr',
      autoBackup: 'weekly',
      keepBackups: 10,
      homeCity: { city: 'Austin', state: 'Texas' },
      lastBackupAt: '2026-01-01T00:00:00Z',
      syncFolder: { uri: 'content://x', name: 'Drive' },
      lastSyncAt: '2026-03-01T00:00:00Z',
      syncBase: { a: '2026-02-01T00:00:00Z', b: 7 },
    };
    expect(normalizeSettings(old)).toEqual({
      theme: 'dark',
      autoBackup: 'weekly',
      // The folder's last sync is now its last backup.
      lastBackupAt: '2026-03-01T00:00:00Z',
      syncFolder: { uri: 'content://x', name: 'Drive' },
      syncBase: { a: '2026-02-01T00:00:00Z' },
    });
    // Without a folder, the dated .zip backups' time stays.
    expect(normalizeSettings({ lastBackupAt: '2026-01-01T00:00:00Z' }).lastBackupAt).toBe('2026-01-01T00:00:00Z');
  });
});
