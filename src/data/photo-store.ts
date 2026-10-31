// Entry photos live as JPEG files in the data directory:
//   photos/<id>.jpg     full size (longest side ≤ 1600px)
//   photos/<id>_t.jpg   thumbnail (longest side ≤ 480px)

import { Capacitor } from '@capacitor/core';
import type { PhotoFiles } from '../lib/backup';
import { list, readBytes, remove, uriOf, writeBytes } from './files';

const DIR = 'photos';
export type PhotoVariant = 'full' | 'thumb';

const fileName = (id: string, variant: PhotoVariant) => `${id}${variant === 'thumb' ? '_t' : ''}.jpg`;
const path = (name: string) => `${DIR}/${name}`;

const urls = new Map<string, string>();

export async function savePhoto(id: string, full: Uint8Array, thumb: Uint8Array): Promise<void> {
  await writeBytes(path(fileName(id, 'full')), full);
  await writeBytes(path(fileName(id, 'thumb')), thumb);
}

/** A URL an <img> can display. Cached per file. */
export async function photoUrl(id: string, variant: PhotoVariant): Promise<string> {
  const name = fileName(id, variant);
  const cached = urls.get(name);
  if (cached) return cached;
  let url: string;
  if (Capacitor.isNativePlatform()) {
    url = Capacitor.convertFileSrc(await uriOf(path(name)));
  } else {
    url = URL.createObjectURL(new Blob([await readBytes(path(name)) as BlobPart], { type: 'image/jpeg' }));
  }
  urls.set(name, url);
  return url;
}

export async function readPhotoBytes(id: string, variant: PhotoVariant): Promise<Uint8Array> {
  return readBytes(path(fileName(id, variant)));
}

export async function deletePhoto(id: string): Promise<void> {
  for (const variant of ['full', 'thumb'] as const) {
    const name = fileName(id, variant);
    const url = urls.get(name);
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    urls.delete(name);
    await remove(path(name));
  }
}

/** Both files for every given photo id, for a backup. Missing files are skipped. */
export async function readPhotoFiles(ids: Iterable<string>): Promise<PhotoFiles> {
  const files: PhotoFiles = new Map();
  for (const id of ids) {
    for (const variant of ['full', 'thumb'] as const) {
      const name = fileName(id, variant);
      try {
        files.set(name, await readBytes(path(name)));
      } catch {
        // A missing file shouldn't stop the backup.
      }
    }
  }
  return files;
}

/** Restores files from a backup. */
export async function writePhotoFiles(files: PhotoFiles): Promise<void> {
  for (const [name, bytes] of files) {
    if (!/^[\w-]+\.jpg$/.test(name)) continue;
    urls.delete(name);
    await writeBytes(path(name), bytes);
  }
}

/**
 * Deletes photo files no entry references (e.g. added to a form that was
 * then cleared). Files touched in the last hour are left alone in case
 * they belong to an entry that's still being edited.
 */
export async function collectGarbage(referenced: ReadonlySet<string>, now = Date.now()): Promise<number> {
  let removed = 0;
  for (const file of await list(DIR)) {
    const id = file.name.replace(/(_t)?\.jpg$/, '');
    if (referenced.has(id) || now - file.mtime < 3_600_000) continue;
    await remove(path(file.name));
    removed++;
  }
  return removed;
}
