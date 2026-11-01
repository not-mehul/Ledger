import { photoUrl } from '../data/photo-store';
import type { Entry } from '../domain/entry';
import { categoryAverage, type YearReview } from '../domain/insights';
import { activeCategories } from '../domain/metrics';
import { scoreTier } from '../domain/score';
import { categoryName, locale, t } from '../i18n/index.svelte';
import { formatMonth } from '../lib/dates';
import { renderCard, renderReviewCard } from '../lib/share-card';
import { shareFile } from '../platform/output';
import { ledger } from './ledger.svelte';

/** Average rating per category, for categories the entry has ratings in. */
export function categoryAverages(entry: Entry): { label: string; average: number }[] {
  return activeCategories(ledger.config).flatMap((cat) => {
    const average = categoryAverage(entry, ledger.config, cat.id);
    return average === null ? [] : [{ label: categoryName(cat), average }];
  });
}

export async function shareEntryCard(entry: Entry): Promise<void> {
  const cover = entry.photos[0];
  const score = ledger.scoreOf(entry);
  const blob = await renderCard({
    city: entry.city,
    region: entry.state,
    month: formatMonth(entry.date, locale()),
    score,
    // The tier's name, without the sentence after the dash.
    tier: score === null ? null : (t(`tier.${scoreTier(score).id}`).split(' — ')[0] ?? null),
    categories: categoryAverages(entry),
    photoUrl: cover ? await photoUrl(cover.id, 'full') : undefined,
    brand: 'Ledger',
    tagline: t('share.tagline'),
  });
  const slug = entry.city.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'city';
  await shareFile(
    { name: `ledger-${slug}.png`, data: new Uint8Array(await blob.arrayBuffer()), mime: 'image/png' },
    t('action.share'),
  );
}

export async function shareYearReview(review: YearReview, stats: { value: string; label: string }[]): Promise<void> {
  const blob = await renderReviewCard({
    kicker: review.year === null ? t('insights.allTime') : t('insights.review'),
    title: review.year === null ? t('insights.reviewTitleAll') : t('insights.reviewTitle', { year: review.year }),
    stats,
    best: review.best
      ? { label: t('insights.best'), city: review.best.entry.city, score: review.best.value }
      : undefined,
    winners: review.winners.map((w) => ({ label: categoryName(w.category), city: w.entry.city, average: w.average })),
    brand: 'Ledger',
    tagline: t('share.tagline'),
  });
  await shareFile(
    { name: `ledger-${review.year ?? 'all-time'}-review.png`, data: new Uint8Array(await blob.arrayBuffer()), mime: 'image/png' },
    t('insights.share'),
  );
}
