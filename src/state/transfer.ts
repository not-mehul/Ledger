// ============================================================
// Import, export and backups, wired to app state.
// ============================================================

import { readPhotoFiles } from '../data/photo-store';
import { locale, t } from '../i18n/index.svelte';
import { buildCsv } from '../lib/csv';
import { buildMarkdown, parseMarkdown, type ParsedImport } from '../lib/markdown';
import { BACKUP_PREFIX, backupsToPrune, isBackupDue } from '../lib/schedule';
import { datedName, deleteOutput, isNative, listOutputs, saveFile, type OutputFile } from '../platform/output';
import { ledger, type ImportSummary } from './ledger.svelte';

export type ExportFormat = 'markdown' | 'csv' | 'json' | 'backup';

export const BACKUP_FOLDER = 'Ledger/Backups';

/** The zip library is only needed for backups, so it loads on demand. */
const backupLib = () => import('../lib/backup');

async function backupFile(now = new Date()): Promise<OutputFile> {
  const { buildBackupZip, buildJson } = await backupLib();
  const entries = ledger.entries;
  const photos = await readPhotoFiles(entries.flatMap((e) => e.photos.map((p) => p.id)));
  return {
    name: datedName(BACKUP_PREFIX, 'zip', now, true),
    data: buildBackupZip(buildJson(entries, ledger.config, now), photos),
    mime: 'application/zip',
  };
}

export async function buildExport(format: ExportFormat): Promise<OutputFile> {
  const ctx = { config: ledger.config, t, locale: locale() };
  switch (format) {
    case 'markdown':
      return { name: datedName('ledger', 'md'), data: buildMarkdown(ledger.entries, ctx), mime: 'text/markdown' };
    case 'csv':
      return { name: datedName('ledger', 'csv'), data: buildCsv(ledger.entries, ctx), mime: 'text/csv' };
    case 'json': {
      const { buildJson } = await backupLib();
      return { name: datedName('ledger', 'json'), data: buildJson(ledger.entries, ledger.config), mime: 'application/json' };
    }
    case 'backup':
      return backupFile();
  }
}

/** Returns a toast message. */
export async function exportAs(format: ExportFormat): Promise<{ message: string; ok: boolean }> {
  if (!ledger.entries.length) return { message: t('export.nothing'), ok: false };
  try {
    const { savedTo } = await saveFile(await buildExport(format));
    if (format === 'backup') await ledger.updateSettings({ lastBackupAt: new Date().toISOString() });
    return { message: savedTo ? t('export.saved', { path: savedTo }) : t('export.ready'), ok: true };
  } catch (err) {
    console.error('Export failed:', err);
    return { message: t('export.failed'), ok: false };
  }
}

export async function readImport(file: File): Promise<ParsedImport & { photos?: Map<string, Uint8Array> }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { isZip, parseBackupZip, parseJson } = await backupLib();
  if (isZip(bytes)) return parseBackupZip(bytes);
  const text = new TextDecoder().decode(bytes);
  if (/^\s*[[{]/.test(text)) return parseJson(text);
  return parseMarkdown(text);
}

export function describeImport(s: ImportSummary): string {
  const parts = [t('import.added', { count: s.added }), t('import.updated', { count: s.updated })];
  if (s.unchanged) parts.push(t('import.unchanged', { count: s.unchanged }));
  if (s.skipped) parts.push(t('import.unreadable', { count: s.skipped }));
  if (s.metricsAdded) parts.push(t('import.metrics', { count: s.metricsAdded }));
  return t('import.done', { summary: parts.join(', ') });
}

export async function importFile(file: File): Promise<{ message: string; ok: boolean }> {
  try {
    const parsed = await readImport(file);
    if (!parsed.entries.length) return { message: t('import.none'), ok: false };
    const summary = await ledger.import(parsed, parsed.photos);
    return { message: describeImport(summary), ok: true };
  } catch (err) {
    console.error('Import failed:', err);
    return { message: t('import.failed'), ok: false };
  }
}

// ---------- automatic backups ----------

/** Writes a backup to Documents/Ledger/Backups and prunes old ones. */
export async function backupNow(): Promise<string> {
  const now = new Date();
  const { savedTo } = await saveFile(await backupFile(now), { folder: BACKUP_FOLDER, share: false });
  await ledger.updateSettings({ lastBackupAt: now.toISOString() });
  for (const name of backupsToPrune(await listOutputs(BACKUP_FOLDER), ledger.settings.keepBackups)) {
    await deleteOutput(BACKUP_FOLDER, name).catch(() => undefined);
  }
  return savedTo ?? `Documents/${BACKUP_FOLDER}`;
}

let running = false;

/** Called on launch and when the app returns to the foreground. */
export async function autoBackupIfDue(): Promise<void> {
  const { autoBackup, lastBackupAt } = ledger.settings;
  if (!isNative || running || ledger.status !== 'ready' || !ledger.entries.length) return;
  if (!isBackupDue(autoBackup, lastBackupAt)) return;
  running = true;
  try {
    await backupNow();
  } catch (err) {
    console.warn('Automatic backup failed:', err);
  } finally {
    running = false;
  }
}
