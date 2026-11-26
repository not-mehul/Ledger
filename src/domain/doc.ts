// ============================================================
// The ledger document: everything the app persists, in one JSON
// file. Bump SCHEMA_VERSION and extend `migrate` for any change to
// the shape, never edit a shipped migration step.
// ============================================================

import { normalizeEntry, type Entry } from './entry';
import { defaultConfig, normalizeConfig, type MetricConfig } from './metrics';

export const SCHEMA_VERSION = 2;

export type ThemeSetting = 'system' | 'light' | 'dark';
export type BackupFrequency = 'off' | 'daily' | 'weekly' | 'monthly';

export interface Settings {
  theme: ThemeSetting;
  /** How often to back up to the folder: checked when the app opens or comes back. */
  autoBackup: BackupFrequency;
  /** ISO timestamp of the last backup to the folder. */
  lastBackupAt?: string;
  /** ISO timestamp of the last backup that failed, until one succeeds. */
  backupFailedAt?: string;
  /** The backup folder (Android), reached through the picker's lasting permission. */
  syncFolder?: { uri: string; name: string };
  /** What the backup folder held after the last backup: entry id → savedAt (src/domain/sync-merge.ts). */
  syncBase?: Record<string, string>;
}

export interface LedgerDoc {
  schemaVersion: typeof SCHEMA_VERSION;
  config: MetricConfig;
  entries: Entry[];
  settings: Settings;
}

export function defaultSettings(): Settings {
  return { theme: 'system', autoBackup: 'daily' };
}

export function emptyDoc(): LedgerDoc {
  return { schemaVersion: SCHEMA_VERSION, config: defaultConfig(), entries: [], settings: defaultSettings() };
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const when = (v: unknown): string | undefined => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : undefined);

/**
 * Settings as stored, cleaned up. Fields Ledger no longer has (a language,
 * how many dated backups to keep, a home city) are dropped. Up to 2.0 the
 * folder was a "sync" folder with its own lastSyncAt, and lastBackupAt
 * meant a dated .zip in Documents: with a folder, its last sync is now the
 * last backup.
 */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = defaultSettings();
  const folder = backupFolder(r);
  const last = folder ? (when(r.lastSyncAt) ?? when(r.lastBackupAt)) : when(r.lastBackupAt);
  const failed = when(r.backupFailedAt);
  return {
    theme: pick(r.theme, ['system', 'light', 'dark'], d.theme),
    autoBackup: pick(r.autoBackup, ['off', 'daily', 'weekly', 'monthly'], d.autoBackup),
    ...(last ? { lastBackupAt: last } : {}),
    ...(failed ? { backupFailedAt: failed } : {}),
    ...folder,
  };
}

function backupFolder(r: Record<string, unknown>): Pick<Settings, 'syncFolder' | 'syncBase'> | undefined {
  const folder = r.syncFolder as { uri?: unknown; name?: unknown } | undefined;
  if (!folder || typeof folder.uri !== 'string' || !folder.uri) return undefined;
  const base: Record<string, string> = {};
  if (r.syncBase && typeof r.syncBase === 'object') {
    for (const [id, at] of Object.entries(r.syncBase as Record<string, unknown>)) if (typeof at === 'string') base[id] = at;
  }
  return { syncFolder: { uri: folder.uri, name: typeof folder.name === 'string' ? folder.name : '' }, syncBase: base };
}

export function normalizeEntries(raw: unknown): Entry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const entries: Entry[] = [];
  for (const item of raw) {
    const e = normalizeEntry(item);
    if (e && !seen.has(e.id)) {
      seen.add(e.id);
      entries.push(e);
    }
  }
  return entries;
}

/**
 * Upgrades any stored or imported document to the current schema.
 *  - v1 (Travel Logbook / early Ledger): a bare array of entries with the
 *    fixed twelve metrics.
 *  - v2: { schemaVersion, config, entries, settings }.
 */
export function migrate(raw: unknown): LedgerDoc {
  if (Array.isArray(raw)) return { ...emptyDoc(), entries: normalizeEntries(raw) };
  if (!raw || typeof raw !== 'object') return emptyDoc();
  const r = raw as Record<string, unknown>;
  return {
    schemaVersion: SCHEMA_VERSION,
    config: r.config ? normalizeConfig(r.config) : defaultConfig(),
    entries: normalizeEntries(r.entries),
    settings: normalizeSettings(r.settings),
  };
}
