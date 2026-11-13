// ============================================================
// The Android home-screen widget (LedgerWidget.java). It can't read
// the app's files, so after each change the app sends it a few ready-
// written lines over the bridge, in the app's language.
// ============================================================

import { registerPlugin } from '@capacitor/core';
import type { Entry } from '../domain/entry';
import { formatMonth } from '../lib/dates';
import type { Translate } from '../i18n/index.svelte';
import { isNative } from './output';

export interface WidgetLines {
  /** "12 cities" */
  headline: string;
  /** "5 countries" (or the empty-state prompt). */
  detail: string;
  /** "Latest: Lisbon · May 2026" */
  latest: string;
  /** "78" out of 100, or "" when unscored. */
  score: string;
}

interface WidgetIO {
  update(lines: WidgetLines): Promise<void>;
}

const Widget = registerPlugin<WidgetIO>('LedgerWidget');

export function widgetLines(
  entries: readonly Entry[],
  scoreOf: (e: Entry) => number | null,
  t: Translate,
  locale: string,
): WidgetLines {
  if (!entries.length) return { headline: 'Ledger', detail: t('widget.empty'), latest: '', score: '' };
  const cities = new Set(entries.map((e) => `${e.city.toLowerCase()}|${e.state.toLowerCase()}`)).size;
  const countries = new Set(entries.map((e) => e.country ?? e.state.toLowerCase())).size;
  const latest = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt))[0]!;
  const score = scoreOf(latest);
  return {
    headline: t('widget.cities', { count: cities }),
    detail: t('widget.countries', { count: countries }),
    latest: t('widget.latest', { place: `${latest.city} · ${formatMonth(latest.date, locale)}` }),
    score: score === null ? '' : String(Math.round(score)),
  };
}

let last = '';

/** Sends the widget its lines, when they have changed. */
export function updateWidget(lines: WidgetLines): void {
  if (!isNative) return;
  const key = JSON.stringify(lines);
  if (key === last) return;
  last = key;
  void Widget.update(lines).catch((err: unknown) => console.warn('Widget update failed', err));
}
