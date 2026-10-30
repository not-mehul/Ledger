import { describe, expect, it } from 'vitest';
import { backupsToPrune, isBackupDue } from '../../src/lib/schedule';

const DAY = 86_400_000;

describe('backup schedule', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('decides when a backup is due', () => {
    expect(isBackupDue('off', undefined, now)).toBe(false);
    expect(isBackupDue('weekly', undefined, now)).toBe(true);
    expect(isBackupDue('daily', ago(DAY - 30 * 60_000), now)).toBe(true); // within the hour of slack
    expect(isBackupDue('daily', ago(DAY / 2), now)).toBe(false);
    expect(isBackupDue('weekly', ago(6 * DAY), now)).toBe(false);
    expect(isBackupDue('monthly', ago(31 * DAY), now)).toBe(true);
  });

  it('prunes the oldest backups only', () => {
    const names = [
      'ledger-backup-2026-10-01-0900.zip',
      'ledger-backup-2026-10-15-0900.zip',
      'notes.txt',
      'ledger-backup-2026-09-01-0900.zip',
      'ledger-backup-2026-10-29-2100.zip',
    ];
    expect(backupsToPrune(names, 2)).toEqual(['ledger-backup-2026-10-01-0900.zip', 'ledger-backup-2026-09-01-0900.zip']);
    expect(backupsToPrune(names, 10)).toEqual([]);
  });
});
