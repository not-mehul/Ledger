// ============================================================
// Markdown export / import.
// Each entry embeds its JSON in an HTML comment, and the metric
// configuration is embedded once, so a file written by
// `buildMarkdown` can be read back losslessly by `parseMarkdown`.
// Files exported by Travel Logbook (the app's former name) use the
// same entry format and import cleanly.
// ============================================================

import { sortEntries, type Entry } from '../domain/entry';
import { activeCategories, metricsIn, normalizeConfig, RATING_MAX, type MetricConfig } from '../domain/metrics';
import { calcScore, scoreTier } from '../domain/score';
import { categoryName, metricName, type Locale, type Translate } from '../i18n/index.svelte';
import { normalizeEntry } from '../domain/entry';
import { formatMonth } from './dates';

export interface ExportContext {
  config: MetricConfig;
  t: Translate;
  locale: Locale;
}

export interface ParsedImport {
  entries: Entry[];
  /** Data blocks that were present but could not be read. */
  skipped: number;
  config?: MetricConfig;
}

const DATA_RE = /^<!-- data:(.*) -->$/;
const METRICS_RE = /^<!-- metrics:(.*) -->$/;

function bar(value: number, max = RATING_MAX): string {
  const filled = Math.max(0, Math.min(max, Math.round(value)));
  return '█'.repeat(filled) + '░'.repeat(max - filled);
}

/** JSON can only contain "-->" inside strings, where "\u003e" is an equivalent escape. */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('-->', '--\\u003e');
}

/** Cells can't contain raw pipes or newlines. */
function cell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function buildMarkdown(entries: readonly Entry[], ctx: ExportContext, now = new Date()): string {
  const { config, t, locale } = ctx;
  const exported = now.toLocaleString(locale, { dateStyle: 'full', timeStyle: 'short' });

  const lines: string[] = [
    `# 🧭 ${t('md.title')}`,
    `*${t('md.subtitle')}*`,
    '',
    `> **${t('md.total')}:** ${entries.length}`,
    `> **${t('md.exported')}:** ${exported}`,
    `<!-- exportedAt:${now.toISOString()} -->`,
    `<!-- metrics:${embedJson(config)} -->`,
    '',
    '---',
    '',
  ];

  for (const e of sortEntries(entries, 'date')) {
    const score = calcScore(e.ratings, config);
    const scoreText = score === null ? '—' : `${scoreTier(score).marker} **${score}** / 100`;
    lines.push(
      `## ${e.city} · ${e.state}`,
      `*${formatMonth(e.date, locale)} · ${scoreText}*`,
      '',
      `<!-- data:${embedJson(e)} -->`,
      '',
    );

    for (const cat of activeCategories(config)) {
      const rated = metricsIn(config, cat.id).filter((m) => typeof e.ratings[m.id] === 'number');
      if (!rated.length) continue;
      lines.push(
        `### ${cat.icon ? `${cat.icon} ` : ''}${categoryName(cat, t)}`,
        `| ${t('md.metric')} | ${t('md.rating')} | ${t('md.weight')} |`,
        '|--------|--------|--------|',
      );
      for (const m of rated) {
        const val = e.ratings[m.id]!;
        lines.push(`| ${cell(metricName(m, t))} | \`${bar(val)}\` ${val}/${RATING_MAX} | ×${m.weight} |`);
      }
      lines.push('');
    }

    if (e.notes) {
      lines.push(`### ${t('md.notes')}`, `> ${e.notes.replaceAll('\n', '\n> ')}`, '');
    }
    lines.push('---', '');
  }

  return lines.join('\n');
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

export function parseMarkdown(markdown: string): ParsedImport {
  const result: ParsedImport = { entries: [], skipped: 0 };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const metrics = METRICS_RE.exec(line);
    if (metrics) {
      const config = parseJson(metrics[1]!);
      if (config) result.config = normalizeConfig(config);
      continue;
    }
    const data = DATA_RE.exec(line);
    if (!data) continue;
    const entry = normalizeEntry(parseJson(data[1]!));
    if (entry) result.entries.push(entry);
    else result.skipped++;
  }

  return result;
}
