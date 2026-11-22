// Thin wrapper over @capacitor/filesystem for the app's private data
// directory: Android's files dir (Auto Backup rules in res/xml), and
// IndexedDB in the web build the tests run.

import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

const dir = Directory.Library;

export async function readText(path: string): Promise<string> {
  const { data } = await Filesystem.readFile({ path, directory: dir, encoding: Encoding.UTF8 });
  return typeof data === 'string' ? data : await data.text();
}

export async function writeText(path: string, text: string): Promise<void> {
  await Filesystem.writeFile({ path, data: text, directory: dir, encoding: Encoding.UTF8, recursive: true });
}

export async function rename(from: string, to: string): Promise<void> {
  await Filesystem.rename({ from, to, directory: dir, toDirectory: dir });
}

/** True when the file is there, readable or not. */
export async function exists(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path, directory: dir });
    return true;
  } catch {
    return false;
  }
}
