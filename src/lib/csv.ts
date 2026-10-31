import { sortEntries, type Entry } from '../domain/entry';
import { activeMetrics } from '../domain/metrics';
import { calcScore } from '../domain/score';
import { metricName } from '../i18n/index.svelte';
import type { ExportContext } from './markdown';

/** RFC 4180 quoting; also neutralises spreadsheet formula injection. */
export function csvCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One row per entry, one column per active metric. Starts with a BOM so Excel reads UTF-8. */
export function buildCsv(entries: readonly Entry[], { config, t }: ExportContext): string {
  const metrics = activeMetrics(config);
  const header = [
    t('csv.city'), t('csv.region'), t('csv.country'), t('csv.month'), t('csv.score'),
    ...metrics.map((m) => metricName(m, t)),
    t('csv.notes'), t('csv.lat'), t('csv.lon'), t('csv.savedAt'),
  ];
  const rows = sortEntries(entries, 'date').map((e) => [
    e.city, e.state, e.country, e.date, calcScore(e.ratings, config) ?? undefined,
    ...metrics.map((m) => e.ratings[m.id]),
    e.notes, e.lat, e.lon, e.savedAt,
  ]);
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
