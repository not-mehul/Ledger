import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildJson, isZip, parseBackupZip, parseJson } from '../../src/lib/backup';
import { addMetric } from '../../src/domain/metrics';
import { config, makeEntry } from './fixtures';

describe('json and zip backups', () => {
  const entries = [makeEntry(), makeEntry({ id: 'e2', city: 'Kyoto' })];
  const custom = addMetric(config, 'food', 'Coffee');

  it('round-trips JSON with the config', () => {
    const parsed = parseJson(buildJson(entries, custom));
    expect(parsed.entries).toEqual(entries);
    expect(parsed.config).toEqual(custom);
    expect(parsed.skipped).toBe(0);
  });

  it('reads a legacy JSON array and counts unreadable rows', () => {
    const parsed = parseJson(JSON.stringify([makeEntry(), { city: '' }]));
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.skipped).toBe(1);
    expect(parsed.config).toBeUndefined();
  });

  it('round-trips a zip', () => {
    const zip = zipSync({ 'ledger.json': strToU8(buildJson(entries, custom)) });
    expect(isZip(zip)).toBe(true);
    const parsed = parseBackupZip(zip);
    expect(parsed.entries).toEqual(entries);
    expect(parsed.config).toEqual(custom);
  });

  it('reads an older backup that still holds photos, and drops them', () => {
    const json = buildJson([{ ...entries[0]!, photos: [{ id: 'p1', width: 4, height: 3 }] } as never], custom);
    const zip = zipSync({ 'ledger.json': strToU8(json), 'photos/p1.jpg': new Uint8Array([0xff, 0xd8, 1]) });
    const parsed = parseBackupZip(zip);
    expect(parsed.entries).toEqual([entries[0]]);
  });

  it('rejects a zip without ledger.json', () => {
    expect(() => parseBackupZip(zipSync({ 'ledger.json': strToU8('{}') }).slice(0, 10))).toThrow();
    expect(() => parseBackupZip(zipSync({ 'notes.txt': strToU8('x') }))).toThrow();
  });
});
