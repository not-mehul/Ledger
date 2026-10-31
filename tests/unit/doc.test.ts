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
    expect(normalizeSettings({ theme: 'neon', language: 'fr', autoBackup: 'daily', keepBackups: 999, lastBackupAt: 'x' })).toEqual({
      theme: 'system',
      language: 'fr',
      autoBackup: 'daily',
      keepBackups: 5,
    });
  });
});
