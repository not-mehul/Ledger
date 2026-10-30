// Thin wrapper over @capacitor/filesystem for the app's private data
// directory (native: the app's files dir, included in OS backups;
// web: IndexedDB).

import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { base64ToBytes, bytesToBase64 } from '../lib/base64';

const dir = Directory.Data;

export async function readText(path: string): Promise<string> {
  const { data } = await Filesystem.readFile({ path, directory: dir, encoding: Encoding.UTF8 });
  return typeof data === 'string' ? data : await data.text();
}

export async function writeText(path: string, text: string): Promise<void> {
  await Filesystem.writeFile({ path, data: text, directory: dir, encoding: Encoding.UTF8, recursive: true });
}

export async function readBytes(path: string): Promise<Uint8Array> {
  const { data } = await Filesystem.readFile({ path, directory: dir });
  return typeof data === 'string' ? base64ToBytes(data) : new Uint8Array(await data.arrayBuffer());
}

export async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  await Filesystem.writeFile({ path, data: bytesToBase64(bytes), directory: dir, recursive: true });
}

export async function rename(from: string, to: string): Promise<void> {
  await Filesystem.rename({ from, to, directory: dir, toDirectory: dir });
}

export async function remove(path: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ path, directory: dir });
  } catch {
    // Already gone.
  }
}

export async function list(path: string): Promise<{ name: string; mtime: number }[]> {
  try {
    const { files } = await Filesystem.readdir({ path, directory: dir });
    return files.filter((f) => f.type === 'file').map((f) => ({ name: f.name, mtime: f.mtime }));
  } catch {
    return [];
  }
}

export async function uriOf(path: string): Promise<string> {
  return (await Filesystem.getUri({ path, directory: dir })).uri;
}
