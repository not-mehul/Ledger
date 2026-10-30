// ============================================================
// JSON export and full .zip backups.
//   ledger.json  → { app, schemaVersion, exportedAt, config, entries }
//   backup .zip  → ledger.json + photos/<id>.jpg (+ photos/<id>_t.jpg)
// Settings are device preferences and aren't included.
// ============================================================

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { SCHEMA_VERSION, migrate } from '../domain/doc';
import type { Entry } from '../domain/entry';
import type { MetricConfig } from '../domain/metrics';
import type { ParsedImport } from './markdown';

export const BACKUP_JSON = 'ledger.json';
const PHOTO_PATH = /^photos\/([\w-]+\.jpg)$/;

export function buildJson(entries: readonly Entry[], config: MetricConfig, now = new Date()): string {
  return JSON.stringify(
    { app: 'ledger', schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), config, entries },
    null,
    2,
  );
}

export function parseJson(text: string): ParsedImport {
  const raw: unknown = JSON.parse(text);
  const count = Array.isArray(raw)
    ? raw.length
    : Array.isArray((raw as { entries?: unknown })?.entries)
      ? (raw as { entries: unknown[] }).entries.length
      : 0;
  const doc = migrate(raw);
  const hasConfig = !Array.isArray(raw) && !!(raw as { config?: unknown })?.config;
  return {
    entries: doc.entries,
    skipped: count - doc.entries.length,
    ...(hasConfig ? { config: doc.config } : {}),
  };
}

/** Photo files keyed by file name, e.g. "3f2a….jpg". */
export type PhotoFiles = Map<string, Uint8Array>;

export function buildBackupZip(json: string, photos: PhotoFiles): Uint8Array {
  const files: Zippable = { [BACKUP_JSON]: strToU8(json) };
  for (const [name, bytes] of photos) {
    // JPEGs are already compressed; store them as-is.
    files[`photos/${name}`] = [bytes, { level: 0 }];
  }
  return zipSync(files, { level: 6 });
}

export function parseBackupZip(bytes: Uint8Array): ParsedImport & { photos: PhotoFiles } {
  const files = unzipSync(bytes);
  const json = files[BACKUP_JSON];
  if (!json) throw new Error(`Backup is missing ${BACKUP_JSON}`);
  const photos: PhotoFiles = new Map();
  for (const [path, data] of Object.entries(files)) {
    const match = PHOTO_PATH.exec(path);
    if (match) photos.set(match[1]!, data);
  }
  return { ...parseJson(strFromU8(json)), photos };
}

export function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}
