import { photoUrl } from '../data/photo-store';
import type { Entry } from '../domain/entry';
import { activeCategories, metricsIn } from '../domain/metrics';
import { categoryName, locale, t } from '../i18n/index.svelte';
import { formatMonth } from '../lib/dates';
import { renderCard } from '../lib/share-card';
import { shareFile } from '../platform/output';
import { ledger } from './ledger.svelte';

/** Average rating per category, for categories the entry has ratings in. */
export function categoryAverages(entry: Entry): { label: string; average: number }[] {
  return activeCategories(ledger.config).flatMap((cat) => {
    const values = metricsIn(ledger.config, cat.id)
      .map((m) => entry.ratings[m.id])
      .filter((v): v is number => typeof v === 'number');
    if (!values.length) return [];
    return [{ label: categoryName(cat), average: values.reduce((a, b) => a + b, 0) / values.length }];
  });
}

export async function shareEntryCard(entry: Entry): Promise<void> {
  const cover = entry.photos[0];
  const blob = await renderCard({
    city: entry.city,
    region: entry.state,
    month: formatMonth(entry.date, locale()),
    score: ledger.scoreOf(entry),
    categories: categoryAverages(entry),
    photoUrl: cover ? await photoUrl(cover.id, 'full') : undefined,
    brand: 'Ledger',
  });
  const slug = entry.city.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'city';
  await shareFile(
    { name: `ledger-${slug}.png`, data: new Uint8Array(await blob.arrayBuffer()), mime: 'image/png' },
    t('action.share'),
  );
}
