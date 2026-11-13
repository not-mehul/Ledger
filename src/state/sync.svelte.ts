// ============================================================
// Folder sync (Android). One file, "Ledger sync.zip" (the same zip as
// a full backup: ledger.json and the photos), in a folder the person
// picks, which Syncthing, Drive, Nextcloud or any other app keeps the
// same across phones. On launch, on coming back and after a change,
// Ledger reads the folder's copy, merges it (src/domain/sync-merge.ts)
// and writes the result back. Nothing leaves the phone except through
// the app that syncs the folder.
// ============================================================

import { baseOf } from '../domain/sync-merge';
import { readPhotoFiles } from '../data/photo-store';
import { base64ToBytes, bytesToBase64 } from '../lib/base64';
import { FolderSync, type SyncFolderIO } from '../platform/folder';
import { isNative } from '../platform/output';
import { ledger } from './ledger.svelte';

export const SYNC_FILE = 'Ledger sync.zip';

export type SyncResult = 'off' | 'synced' | 'failed';

const backupLib = () => import('../lib/backup');

export class FolderSyncState {
  busy = $state(false);
  /** When the folder's file last changed, as this phone last saw it: an unchanged file isn't read again. */
  private seen: number | undefined;
  private running: Promise<SyncResult> | null = null;
  private pushTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly io: SyncFolderIO = FolderSync) {}

  get on(): boolean {
    return !!ledger.settings.syncFolder;
  }

  /** Reads and merges the folder's copy, then writes this one back. One sync at a time. */
  now(): Promise<SyncResult> {
    this.running ??= this.run().finally(() => (this.running = null));
    return this.running;
  }

  /** After a local change: sync a few seconds later, once the edits settle. */
  soon(): void {
    if (!this.on || !isNative || this.busy) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => void this.now(), 4000);
  }

  private async run(): Promise<SyncResult> {
    const folder = ledger.settings.syncFolder;
    if (!folder || !isNative || ledger.status !== 'ready') return 'off';
    this.busy = true;
    try {
      const { buildBackupZip, buildJson, parseBackupZip } = await backupLib();
      const theirs = await this.io.read({ uri: folder.uri, file: SYNC_FILE, since: this.seen });
      if (theirs.data) {
        await ledger.mergeSynced(parseBackupZip(base64ToBytes(theirs.data)), ledger.settings.syncBase ?? {});
      }
      const entries = ledger.entries;
      const photos = await readPhotoFiles(entries.flatMap((e) => e.photos.map((p) => p.id)));
      const { modified } = await this.io.write({
        uri: folder.uri,
        file: SYNC_FILE,
        data: bytesToBase64(buildBackupZip(buildJson(entries, ledger.config), photos)),
      });
      this.seen = modified || undefined;
      // The folder now holds exactly these entries: that is what the next sync compares against.
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a timestamp, not state
      await ledger.updateSettings({ lastSyncAt: new Date(Date.now()).toJSON(), syncBase: baseOf(entries) });
      return 'synced';
    } catch (err) {
      console.error('Sync failed', err);
      return 'failed';
    } finally {
      this.busy = false;
    }
  }

  /** Opens the folder picker, then syncs straight away with the folder chosen. */
  async choose(): Promise<SyncResult> {
    const picked = await this.io.pick();
    if (!picked.uri) return 'off';
    const old = ledger.settings.syncFolder;
    if (old && old.uri !== picked.uri) await this.io.release({ uri: old.uri }).catch(() => undefined);
    this.seen = undefined;
    // A new folder starts from nothing known: everything in it is new, nothing is a deletion.
    await ledger.updateSettings({ syncFolder: { uri: picked.uri, name: picked.name ?? '' }, syncBase: {}, lastSyncAt: undefined });
    return this.now();
  }

  /** Stops syncing. The file stays in the folder. */
  async stop(): Promise<void> {
    const old = ledger.settings.syncFolder;
    this.seen = undefined;
    clearTimeout(this.pushTimer);
    await ledger.updateSettings({ syncFolder: undefined, syncBase: undefined, lastSyncAt: undefined });
    if (old) await this.io.release({ uri: old.uri }).catch(() => undefined);
  }
}

export const folderSync = new FolderSyncState();
