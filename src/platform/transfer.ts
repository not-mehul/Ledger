// ============================================================
// Getting data in and out of the app.
// Export writes Documents/Ledger/ledger-YYYY-MM-DD.md (no storage
// permission is needed for files an app creates there on Android 11+)
// and then opens the system share sheet so the file can also be sent
// to Drive, email, etc. Import reads a Markdown export back in.
// ============================================================

import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { Entry } from '../domain/entry';
import { buildMarkdown, parseMarkdown, type ParseResult } from '../lib/markdown';

export interface ExportResult {
  /** Human-readable location of the saved file, if it was saved somewhere durable. */
  savedTo: string | null;
}

function exportFileName(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `ledger-${y}-${m}-${d}.md`;
}

function downloadInBrowser(fileName: string, markdown: string): void {
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportEntries(entries: readonly Entry[]): Promise<ExportResult> {
  const markdown = buildMarkdown(entries);
  const fileName = exportFileName();

  if (!Capacitor.isNativePlatform()) {
    downloadInBrowser(fileName, markdown);
    return { savedTo: `Downloads/${fileName}` };
  }

  let uri: string;
  let savedTo: string | null;
  try {
    ({ uri } = await Filesystem.writeFile({
      path: `Ledger/${fileName}`,
      data: markdown,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    }));
    savedTo = `Documents/Ledger/${fileName}`;
  } catch (err) {
    // E.g. a same-named file left behind by a previous install, which this
    // install doesn't own. The share sheet still lets the user keep a copy.
    console.warn('Could not write to Documents, sharing from cache instead:', err);
    ({ uri } = await Filesystem.writeFile({
      path: fileName,
      data: markdown,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    }));
    savedTo = null;
  }

  try {
    await Share.share({ title: 'Ledger export', files: [uri] });
  } catch {
    // The user dismissed the share sheet — not an error.
  }

  return { savedTo };
}

export async function readImportFile(file: File): Promise<ParseResult> {
  return parseMarkdown(await file.text());
}
