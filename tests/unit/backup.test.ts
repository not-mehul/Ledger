import { describe, expect, it } from 'vitest';
import { buildBackupZip, buildJson, isZip, parseBackupZip, parseJson } from '../../src/lib/backup';
import { addMetric } from '../../src/domain/metrics';
import { config, makeEntry } from './fixtures';

describe('json and zip backups', () => {
  const entries = [makeEntry({ photos: [{ id: 'p1', width: 4, height: 3 }] }), makeEntry({ id: 'e2', city: 'Kyoto' })];
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

  it('round-trips a zip with photos', () => {
    const photo = new Uint8Array([0xff, 0xd8, 1, 2, 3]);
    const zip = buildBackupZip(buildJson(entries, custom), new Map([['p1.jpg', photo], ['p1_t.jpg', photo]]));
    expect(isZip(zip)).toBe(true);
    const parsed = parseBackupZip(zip);
    expect(parsed.entries).toEqual(entries);
    expect([...parsed.photos.keys()].sort()).toEqual(['p1.jpg', 'p1_t.jpg']);
    expect(parsed.photos.get('p1.jpg')).toEqual(photo);
  });

  it('rejects a zip without ledger.json', () => {
    expect(() => parseBackupZip(buildBackupZip('{}', new Map()).slice(0, 10))).toThrow();
  });
});
