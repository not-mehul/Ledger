// ============================================================
// Logbook export
// - buildMarkdown(entries)          → returns the .md string with
//                                     the export date in the header
// - exportLogbook(entries, toast)   → writes to Downloads/logbook.md
//                                     on Android, falls back to a
//                                     browser download in dev mode
// ============================================================

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { METRICS, CATEGORIES } from './config.js';

// ---------- Markdown helpers ----------

function bar(v, max = 10) {
  const f = Math.max(0, Math.min(max, Math.round(v)));
  return '█'.repeat(f) + '░'.repeat(max - f);
}

function fmtDateDisplay(dateStr) {
  if (!dateStr) return '';
  // Legacy weekly format support (YYYY-Www)
  if (dateStr.includes('-W')) {
    const [yearStr, wPart] = dateStr.split('-W');
    const year = parseInt(yearStr);
    const week = parseInt(wPart);
    const jan4 = new Date(year, 0, 4);
    const ws   = new Date(jan4);
    ws.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (week - 1) * 7);
    dateStr    = ws.toISOString().split('T')[0];
  }
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }
  return dateStr;
}

// ---------- Markdown generation ----------

export function buildMarkdown(entries) {
  const now        = new Date();
  const exportDate = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const exportTime = now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit'
  });
  const isoDate    = now.toISOString();

  let md  = `# ✈️ Travel Logbook\n`;
      md += `*A record of cities visited, their character, and your place in them.*\n\n`;
      md += `> **Total cities logged:** ${entries.length}\n`;
      md += `> **Exported:** ${exportDate} · ${exportTime}\n`;
      md += `<!-- exportedAt:${isoDate} -->\n\n`;
      md += `---\n\n`;

  const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(e => {
    const star = e.score >= 85 ? '🟢' : e.score >= 65 ? '🟡' : '🔴';
    md += `## ${e.city} · ${e.state}\n`;
    md += `*${fmtDateDisplay(e.date)} · ${star} Score: **${e.score}** / 100*\n\n`;
    // Embedded JSON so the file stays round-trippable
    md += `<!-- data:${JSON.stringify(e)} -->\n\n`;

    CATEGORIES.forEach(cat => {
      md += `### ${cat.label}\n`;
      md += `| Metric | Rating | Weight |\n`;
      md += `|--------|--------|--------|\n`;
      cat.ids.forEach(id => {
        const m   = METRICS.find(x => x.id === id);
        const val = e.ratings[id] ?? 5;
        md += `| ${m.label} | \`${bar(val)}\` ${val}/10 | ×${m.weight} |\n`;
      });
      md += `\n`;
    });

    if (e.notes) {
      md += `### Notes\n> ${e.notes.replace(/\n/g, '\n> ')}\n\n`;
    }
    md += `---\n\n`;
  });

  return md;
}

// ---------- Native filesystem export ----------

/**
 * Writes Downloads/logbook.md (overwrites any prior export).
 * On Android 11+ the public Downloads folder requires the app to have
 * MANAGE_EXTERNAL_STORAGE granted ("All files access" in app settings).
 * If that's not granted, we fall back to the app's external Documents
 * directory and surface the resulting path in the toast.
 */
export async function exportLogbook(entries, toast) {
  const md = buildMarkdown(entries);

  // Browser dev fallback
  if (!Capacitor.isNativePlatform()) {
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([md], { type: 'text/markdown' })),
      download: 'logbook.md'
    });
    a.click();
    URL.revokeObjectURL(a.href);
    toast?.('logbook.md downloaded.', 'success');
    return { ok: true, path: 'browser-download' };
  }

  // Try to obtain storage permission (no-op on platforms that don't need it)
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage !== 'granted') {
      const req = await Filesystem.requestPermissions();
      if (req.publicStorage !== 'granted') {
        toast?.('Storage permission denied. Grant "All files access" in Settings.', 'error');
        return { ok: false, reason: 'permission-denied' };
      }
    }
  } catch {
    // Older plugin versions don't implement check/requestPermissions for
    // public storage — proceed and let writeFile() surface any failure.
  }

  // Primary: public Downloads folder
  try {
    const result = await Filesystem.writeFile({
      path:      'Download/logbook.md',
      data:      md,
      directory: Directory.ExternalStorage,
      encoding:  Encoding.UTF8,
      recursive: true
    });
    toast?.(`Saved to Downloads/logbook.md`, 'success');
    return { ok: true, path: result.uri };
  } catch (primaryErr) {
    console.warn('Primary export failed, falling back:', primaryErr);

    // Fallback: app-specific external storage (no special permission needed)
    try {
      const result = await Filesystem.writeFile({
        path:      'logbook.md',
        data:      md,
        directory: Directory.External,
        encoding:  Encoding.UTF8,
        recursive: true
      });
      toast?.(
        `Saved to app storage (${result.uri.split('/').slice(-3).join('/')}). ` +
        `Grant "All files access" to save to Downloads.`,
        'success'
      );
      return { ok: true, path: result.uri, fallback: true };
    } catch (fallbackErr) {
      console.error('Fallback export failed:', fallbackErr);
      toast?.('Export failed: ' + (fallbackErr.message || primaryErr.message || 'unknown'), 'error');
      return { ok: false, reason: 'write-failed' };
    }
  }
}
