// ============================================================
// The ledger document: everything the app persists, in one JSON
// file. Bump SCHEMA_VERSION and extend `migrate` for any change to
// the shape, never edit a shipped migration step.
// ============================================================

import { normalizeEntry, type Entry } from './entry';
import { defaultConfig, normalizeConfig, type MetricConfig } from './metrics';

export const SCHEMA_VERSION = 2;

export type ThemeSetting = 'system' | 'light' | 'dark';
export type LanguageSetting = 'system' | 'en' | 'es' | 'fr' | 'de';
export type BackupFrequency = 'off' | 'daily' | 'weekly' | 'monthly';

export interface Settings {
  theme: ThemeSetting;
  language: LanguageSetting;
  autoBackup: BackupFrequency;
  /** How many automatic backups to keep. */
  keepBackups: number;
  /** ISO timestamp of the last automatic or manual backup. */
  lastBackupAt?: string;
}

export interface LedgerDoc {
  schemaVersion: typeof SCHEMA_VERSION;
  config: MetricConfig;
  entries: Entry[];
  settings: Settings;
}

export function defaultSettings(): Settings {
  return { theme: 'system', language: 'system', autoBackup: 'weekly', keepBackups: 5 };
}

export function emptyDoc(): LedgerDoc {
  return { schemaVersion: SCHEMA_VERSION, config: defaultConfig(), entries: [], settings: defaultSettings() };
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = defaultSettings();
  const keep = Math.round(Number(r.keepBackups));
  return {
    theme: pick(r.theme, ['system', 'light', 'dark'], d.theme),
    language: pick(r.language, ['system', 'en', 'es', 'fr', 'de'], d.language),
    autoBackup: pick(r.autoBackup, ['off', 'daily', 'weekly', 'monthly'], d.autoBackup),
    keepBackups: Number.isFinite(keep) && keep >= 1 && keep <= 50 ? keep : d.keepBackups,
    ...(typeof r.lastBackupAt === 'string' && !Number.isNaN(Date.parse(r.lastBackupAt))
      ? { lastBackupAt: r.lastBackupAt }
      : {}),
  };
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
