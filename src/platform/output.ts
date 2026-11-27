// ============================================================
// Sharing a generated file (a city or Year in Review card): written to the
// cache, handed to the share sheet, never kept. Backups go to the folder the
// person picked instead (state/backup.svelte.ts).
// ============================================================

import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { bytesToBase64 } from '../lib/base64';

export interface OutputFile {
  name: string;
  data: string | Uint8Array;
  mime: string;
}

function payload(file: OutputFile) {
  return typeof file.data === 'string'
    ? { data: file.data, encoding: Encoding.UTF8 }
    : { data: bytesToBase64(file.data) };
}

/** Shares a generated file (e.g. a city card) without keeping a copy. */
export async function shareFile(file: OutputFile, title: string): Promise<void> {
  const { uri } = await Filesystem.writeFile({ path: file.name, directory: Directory.Cache, ...payload(file) });
  try {
    await Share.share({ title, files: [uri] });
  } catch {
    // Dismissed.
  }
}
