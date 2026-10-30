import type { BackupFrequency } from '../domain/doc';

export const BACKUP_PREFIX = 'ledger-backup';

const INTERVAL_DAYS: Record<Exclude<BackupFrequency, 'off'>, number> = { daily: 1, weekly: 7, monthly: 30 };

export function isBackupDue(frequency: BackupFrequency, lastBackupAt: string | undefined, now = Date.now()): boolean {
  if (frequency === 'off') return false;
  if (!lastBackupAt) return true;
  // An hour of slack so "daily" doesn't drift later every day.
  return now - Date.parse(lastBackupAt) >= INTERVAL_DAYS[frequency] * 86_400_000 - 3_600_000;
}

/** Backup file names to delete so only the newest `keep` remain. */
export function backupsToPrune(names: readonly string[], keep: number): string[] {
  return names
    .filter((n) => n.startsWith(`${BACKUP_PREFIX}-`) && n.endsWith('.zip'))
    .sort()
    .reverse()
    .slice(keep);
}
