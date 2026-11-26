// ============================================================
// A spreadsheet of the ledger: one row per visit, a column per metric.
// RFC 4180 quoting, CRLF line ends and a byte-order mark, so Excel, Numbers,
// Google Sheets and LibreOffice all open it with accents intact.
// ============================================================

import type { Entry } from '../domain/entry';
import type { MetricConfig } from '../domain/metrics';
import { calcScore, scoreTier } from '../domain/score';
import type { Translate } from '../i18n/index.svelte';
import { metricName } from '../i18n/index.svelte';

export interface CsvContext {
  config: MetricConfig;
  t: Translate;
  countryName: (code: string) => string;
}

/** A field, quoted when it holds a comma, quote or line break, or could be read as a formula. */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // A cell starting with = + - @ runs as a formula in a spreadsheet; a leading quote keeps it text.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(entries: readonly Entry[], ctx: CsvContext): string {
  const { config, t } = ctx;
  // Every metric that isn't removed, hidden ones too, so no rating is left out.
  const metrics = config.metrics;
  const header = [
    t('csv.city'),
    t('csv.region'),
    t('csv.country'),
    t('csv.month'),
    t('csv.score'),
    t('csv.tier'),
    ...metrics.map((m) => metricName(m)),
    t('csv.notes'),
  ];
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.city.localeCompare(b.city))
    .map((e) => {
      const score = calcScore(e.ratings, config);
      return [
        e.city,
        e.state,
        e.country ? ctx.countryName(e.country) : '',
        e.date,
        score,
        score === null ? '' : t(`tierName.${scoreTier(score).id}`),
        ...metrics.map((m) => e.ratings[m.id] ?? null),
        e.notes,
      ];
    });
  return '﻿' + [header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}
