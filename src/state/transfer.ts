// ============================================================
// Restoring a backup: a Ledger backup file (.json, or the .zip backups
// and folder files made before 2.1), or another app's JSON export (Travel
// Logbook). Restoring the same file again never duplicates entries.
// ============================================================

import { t } from '../i18n/index.svelte';
import { ledger, type ImportSummary } from './ledger.svelte';

/** What a restore brings in, before it is merged with the ledger. */
export interface ParsedImport {
  entries: import('../domain/entry').Entry[];
  /** Entries in the file that couldn't be read. */
  skipped: number;
  config?: import('../domain/metrics').MetricConfig;
}

/** The zip library is only needed for older backups, so it loads on demand. */
const backupLib = () => import('../lib/backup');

export async function readBackup(file: File): Promise<ParsedImport> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { isZip, parseBackupZip, parseJson } = await backupLib();
  if (isZip(bytes)) return parseBackupZip(bytes);
  return parseJson(new TextDecoder().decode(bytes));
}

export function describeImport(s: ImportSummary): string {
  const parts = [t('import.added', { count: s.added }), t('import.updated', { count: s.updated })];
  if (s.unchanged) parts.push(t('import.unchanged', { count: s.unchanged }));
  if (s.skipped) parts.push(t('import.unreadable', { count: s.skipped }));
  if (s.metricsAdded) parts.push(t('import.metrics', { count: s.metricsAdded }));
  return t('import.done', { summary: parts.join(', ') });
}

export async function restoreFile(file: File): Promise<{ message: string; ok: boolean }> {
  try {
    const parsed = await readBackup(file);
    if (!parsed.entries.length) return { message: t('import.none'), ok: false };
    const summary = await ledger.import(parsed);
    return { message: describeImport(summary), ok: true };
  } catch (err) {
    console.error('Restore failed:', err);
    return { message: t('import.failed'), ok: false };
  }
}
