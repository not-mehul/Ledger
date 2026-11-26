// ============================================================
// Backup (Android), as BookShelf does it: one file, ledger-backup.json,
// in a folder the person picks, which Google Drive, Nextcloud or Syncthing
// keeps. Each backup reads the folder's copy, merges it with this phone's
// ledger (src/domain/sync-merge.ts), and writes the result back, so every
// phone that backs up to the same folder stays in step. It runs when the
// app opens or comes back, if the last backup is older than the chosen
// frequency, and whenever Back up now is tapped. Nothing leaves the phone
// except through the app that keeps the folder.
// ============================================================

import { baseOf } from '../domain/sync-merge';
import { base64ToBytes, bytesToBase64 } from '../lib/base64';
import { isBackupDue } from '../lib/schedule';
import { FolderSync, type SyncFolderIO } from '../platform/folder';
import { ledger } from './ledger.svelte';

export const BACKUP_FILE = 'ledger-backup.json';
/** What the folder held before 2.1: the same data, zipped. Read once if the .json isn't there yet. */
export const LEGACY_FILE = 'Ledger sync.zip';

export interface BackupReport {
  /** Entries this backup brought in or removed from other phones. */
  brought: number;
}

const backupLib = () => import('../lib/backup');
const isoNow = () => new Date(Date.now()).toJSON();

export class BackupState {
  busy = $state(false);
  /** When the folder's file last changed, as this phone last saw it: an unchanged file isn't read again. */
  private seen: number | undefined;
  private running: Promise<BackupReport> | null = null;

  constructor(private readonly io: SyncFolderIO = FolderSync) {}

  get on(): boolean {
    return !!ledger.settings.syncFolder;
  }

  /** Merges with the folder's copy and writes the result back. One at a time; throws if it fails. */
  now(): Promise<BackupReport> {
    this.running ??= this.run().finally(() => (this.running = null));
    return this.running;
  }

  /** On launch and on coming back: back up if a folder is chosen and one is due. Never throws. */
  async ifDue(): Promise<void> {
    const { syncFolder, autoBackup, lastBackupAt } = ledger.settings;
    if (!syncFolder || ledger.status !== 'ready' || !isBackupDue(autoBackup, lastBackupAt)) return;
    await this.now().catch((err: unknown) => console.warn('Backup failed:', err));
  }

  private async run(): Promise<BackupReport> {
    const folder = ledger.settings.syncFolder;
    if (!folder) throw new Error('No backup folder chosen');
    if (ledger.status !== 'ready') throw new Error('The ledger is not open');
    this.busy = true;
    try {
      const { buildJson, parseBackupZip, parseJson } = await backupLib();
      let brought = 0;
      const theirs = await this.io.read({ uri: folder.uri, file: BACKUP_FILE, since: this.seen });
      let remote = theirs.data ? parseJson(new TextDecoder().decode(base64ToBytes(theirs.data))) : null;
      if (!theirs.data && theirs.modified === undefined) {
        // No .json yet: a folder set up before 2.1 holds the zip.
        const old = await this.io.read({ uri: folder.uri, file: LEGACY_FILE });
        if (old.data) remote = parseBackupZip(base64ToBytes(old.data));
      }
      if (remote) {
        const merge = await ledger.mergeSynced(remote, ledger.settings.syncBase ?? {});
        brought = merge.incoming.length + merge.removed.length;
      }
      const entries = ledger.entries;
      const { modified } = await this.io.write({
        uri: folder.uri,
        file: BACKUP_FILE,
        data: bytesToBase64(new TextEncoder().encode(buildJson(entries, ledger.config))),
      });
      this.seen = modified || undefined;
      // The folder now holds exactly these entries: that is what the next backup compares against.
      await ledger.updateSettings({ lastBackupAt: isoNow(), backupFailedAt: undefined, syncBase: baseOf(entries) });
      return { brought };
    } catch (err) {
      await ledger.updateSettings({ backupFailedAt: isoNow() }).catch(() => undefined);
      throw err;
    } finally {
      this.busy = false;
    }
  }

  /** Opens the folder picker, then backs up straight away to the folder chosen. False if none was picked. */
  async choose(): Promise<boolean> {
    const picked = await this.io.pick();
    if (!picked.uri) return false;
    const old = ledger.settings.syncFolder;
    if (old && old.uri !== picked.uri) await this.io.release({ uri: old.uri }).catch(() => undefined);
    this.seen = undefined;
    // A new folder starts from nothing known: everything in it is new, nothing is a deletion.
    await ledger.updateSettings({
      syncFolder: { uri: picked.uri, name: picked.name ?? '' },
      syncBase: {},
      lastBackupAt: undefined,
      backupFailedAt: undefined,
    });
    return true;
  }

  /** Stops backing up. The file stays in the folder. */
  async stop(): Promise<void> {
    const old = ledger.settings.syncFolder;
    this.seen = undefined;
    await ledger.updateSettings({ syncFolder: undefined, syncBase: undefined, lastBackupAt: undefined, backupFailedAt: undefined });
    if (old) await this.io.release({ uri: old.uri }).catch(() => undefined);
  }
}

export const backup = new BackupState();
