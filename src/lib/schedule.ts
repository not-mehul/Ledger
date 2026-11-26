import type { BackupFrequency } from '../domain/doc';

const INTERVAL_DAYS: Record<Exclude<BackupFrequency, 'off'>, number> = { daily: 1, weekly: 7, monthly: 30 };

export function isBackupDue(frequency: BackupFrequency, lastBackupAt: string | undefined, now = Date.now()): boolean {
  if (frequency === 'off') return false;
  const last = lastBackupAt ? Date.parse(lastBackupAt) : NaN;
  // Never backed up, or a time in the future (the clock was wrong then): due now.
  if (Number.isNaN(last) || last > now) return true;
  // An hour of slack so "daily" doesn't drift later every day.
  return now - last >= INTERVAL_DAYS[frequency] * 86_400_000 - 3_600_000;
}
