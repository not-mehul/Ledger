// ============================================================
// Markdown export / import.
// Each entry embeds its JSON in an HTML comment so a file written
// by `buildMarkdown` can be read back losslessly by `parseMarkdown`.
// Files exported by Travel Logbook (the app's former name) use the
// same format and import cleanly.
// ============================================================

import { normalizeEntry, sortEntries, type Entry } from '../domain/entry';
import { CATEGORIES, RATING_DEFAULT, RATING_MAX, metricsIn } from '../domain/metrics';
import { scoreTier } from '../domain/score';
import { formatMonth } from './dates';

const DATA_RE = /^<!-- data:(.*) -->$/;

function bar(value: number, max = RATING_MAX): string {
  const filled = Math.max(0, Math.min(max, Math.round(value)));
  return '█'.repeat(filled) + '░'.repeat(max - filled);
}

/** JSON can only contain "-->" inside strings, where "\u003e" is an equivalent escape. */
function embedJson(entry: Entry): string {
  return JSON.stringify(entry).replaceAll('-->', '--\\u003e');
}

/** Cells can't contain raw pipes or newlines. */
function cell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function buildMarkdown(entries: readonly Entry[], now = new Date()): string {
  const exportDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const exportTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const lines: string[] = [
    '# 🧭 Ledger',
    '*A record of cities visited, their character, and your place in them.*',
    '',
    `> **Total cities logged:** ${entries.length}`,
    `> **Exported:** ${exportDate} · ${exportTime}`,
    `<!-- exportedAt:${now.toISOString()} -->`,
    '',
    '---',
    '',
  ];

  for (const e of sortEntries(entries, 'date')) {
    const { marker } = scoreTier(e.score);
    lines.push(
      `## ${e.city} · ${e.state}`,
      `*${formatMonth(e.date)} · ${marker} Score: **${e.score}** / 100*`,
      '',
      `<!-- data:${embedJson(e)} -->`,
      '',
    );

    for (const cat of CATEGORIES) {
      lines.push(`### ${cat.label}`, '| Metric | Rating | Weight |', '|--------|--------|--------|');
      for (const m of metricsIn(cat.id)) {
        const val = e.ratings[m.id] ?? RATING_DEFAULT;
        lines.push(`| ${cell(m.label)} | \`${bar(val)}\` ${val}/${RATING_MAX} | ×${m.weight} |`);
      }
      lines.push('');
    }

    if (e.notes) {
      lines.push('### Notes', `> ${e.notes.replaceAll('\n', '\n> ')}`, '');
    }
    lines.push('---', '');
  }

  return lines.join('\n');
}

function parseEntryJson(json: string): Entry | null {
  try {
    return normalizeEntry(JSON.parse(json));
  } catch {
    return null;
  }
}

export interface ParseResult {
  entries: Entry[];
  /** Data blocks that were present but could not be read. */
  skipped: number;
}

export function parseMarkdown(markdown: string): ParseResult {
  const entries: Entry[] = [];
  let skipped = 0;

  for (const line of markdown.split(/\r?\n/)) {
    const match = DATA_RE.exec(line.trim());
    if (!match) continue;
    const entry = parseEntryJson(match[1]!);
    if (entry) entries.push(entry);
    else skipped++;
  }

  return { entries, skipped };
}
