// ============================================================
// JSON export and full .zip backups.
//   ledger.json  → { app, schemaVersion, exportedAt, config, entries }
//   backup .zip  → ledger.json (older backups also hold photos/, which
//                  Ledger no longer keeps and ignores on import)
// Settings are device preferences and aren't included.
// ============================================================

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { SCHEMA_VERSION, migrate } from '../domain/doc';
import type { Entry } from '../domain/entry';
import type { MetricConfig } from '../domain/metrics';
import type { ParsedImport } from './markdown';

export const BACKUP_JSON = 'ledger.json';

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

export function buildBackupZip(json: string): Uint8Array {
  return zipSync({ [BACKUP_JSON]: strToU8(json) }, { level: 6 });
}

export function parseBackupZip(bytes: Uint8Array): ParsedImport {
  // Only ledger.json is unpacked: photos in older backups are skipped unread.
  const files = unzipSync(bytes, { filter: (file) => file.name === BACKUP_JSON });
  const json = files[BACKUP_JSON];
  if (!json) throw new Error(`Backup is missing ${BACKUP_JSON}`);
  return parseJson(strFromU8(json));
}

export function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}
