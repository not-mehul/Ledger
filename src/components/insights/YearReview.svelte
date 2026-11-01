<script lang="ts">
  import type { Entry } from '../../domain/entry';
  import { yearReview } from '../../domain/insights';
  import { categoryName, locale, t } from '../../i18n/index.svelte';
  import { formatMonth } from '../../lib/dates';
  import { ledger } from '../../state/ledger.svelte';
  import { shareYearReview } from '../../state/share';
  import { ui } from '../../state/ui.svelte';
  import ScoreDial from '../ScoreDial.svelte';

  interface Props {
    year: number | null;
  }

  let { year }: Props = $props();
  let sharing = $state(false);

  const review = $derived(yearReview(ledger.entries, ledger.config, year));
  const number = $derived(new Intl.NumberFormat(locale()));
  const regionNames = $derived(new Intl.DisplayNames([locale()], { type: 'region' }));
  const countryList = $derived(review.countries.map((c) => regionNames.of(c) ?? c).join(' · '));

  const stats = $derived([
    { id: 'cities', value: number.format(review.cities), label: t('insights.statCities') },
    { id: 'countries', value: number.format(review.countries.length), label: t('insights.statCountries') },
    { id: 'months', value: number.format(review.months), label: t('insights.statMonths') },
    { id: 'distance', value: number.format(review.distanceKm), label: t('insights.statDistance') },
    { id: 'photos', value: number.format(review.photos), label: t('insights.statPhotos') },
    { id: 'average', value: review.averageScore === null ? '—' : review.averageScore.toFixed(1), label: t('insights.statAverage') },
  ]);

  const place = (e: Entry) => `${e.city}, ${e.state}`;

  async function share() {
    sharing = true;
    try {
      await shareYearReview(review, stats);
    } catch (err) {
      console.error('Year in review card failed:', err);
      ui.notify(t('toast.shareFailed'), 'error');
    } finally {
      sharing = false;
    }
  }
</script>

<section class="panel" id="yearReview" aria-labelledby="reviewHeading">
  <div class="section-head">
    <h2 id="reviewHeading">{year === null ? t('insights.reviewTitleAll') : t('insights.reviewTitle', { year })}</h2>
  </div>

  <dl class="stats">
    {#each stats as stat (stat.id)}
      <div class="stat" data-stat={stat.id}>
        <dt>{stat.label}</dt>
        <dd>{stat.value}</dd>
      </div>
    {/each}
  </dl>
  {#if countryList}
    <p class="countries">{countryList}</p>
  {/if}

  {#if review.best}
    <div class="highlights">
      {#each [{ key: 'insights.best', r: review.best }, ...(review.worst ? [{ key: 'insights.worst', r: review.worst }] : [])] as h (h.key)}
        <button type="button" class="highlight" onclick={() => ui.showInLedger(h.r.entry.id)}>
          <ScoreDial score={h.r.value} size={48} stroke={7} labelled />
          <span>
            <span class="mini-cat-label">{t(h.key as 'insights.best' | 'insights.worst')}</span>
            <span class="entry-city-name">{place(h.r.entry)}</span>
          </span>
        </button>
      {/each}
    </div>
  {/if}

  {#if review.winners.length}
    <div class="mini-cat-label winners-label">{t('insights.winners')}</div>
    <ul class="winners">
      {#each review.winners as w (w.category.id)}
        <li>
          <button type="button" onclick={() => ui.showInLedger(w.entry.id)}>
            <span class="w-cat">{w.category.icon ? `${w.category.icon} ` : ''}{categoryName(w.category)}</span>
            <span class="w-city">{w.entry.city}</span>
            <span class="mini-val">{w.average.toFixed(1)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if review.first && review.latest && review.first !== review.latest}
    <p class="span-note">
      {t('insights.first')}: {review.first.city} ({formatMonth(review.first.date, locale())}) ·
      {t('insights.latest')}: {review.latest.city} ({formatMonth(review.latest.date, locale())})
    </p>
  {/if}

  <button type="button" class="btn btn-secondary" id="shareReview" disabled={sharing || !review.cities} onclick={share}>
    {t('insights.share')}{sharing ? ' …' : ''}
  </button>
</section>

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.25rem 0.75rem;
    margin-bottom: 1rem;
  }
  .stat {
    display: flex;
    flex-direction: column-reverse;
    gap: 0.25rem;
  }
  dd {
    font-family: var(--font-mono);
    font-size: 1.75rem;
    color: var(--text-heading);
    line-height: 1;
  }
  dt {
    font-size: 0.5625rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .countries {
    font-size: 0.75rem;
    color: var(--text-dim);
    line-height: 1.6;
    margin-bottom: 1.25rem;
  }
  .highlights {
    display: grid;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }
  .highlight {
    display: flex;
    gap: 0.875rem;
    align-items: center;
    width: 100%;
    padding: 0.625rem 0.75rem;
    background: var(--panel-bg-faint);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius);
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .highlight > span {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .highlight .mini-cat-label {
    margin: 0 0 0.25rem;
  }
  .winners-label {
    margin-top: 0;
  }
  .winners {
    list-style: none;
    margin-bottom: 1.25rem;
  }
  .winners button {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto;
    gap: 0.75rem;
    align-items: baseline;
    width: 100%;
    padding: 0.5rem 0;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border-soft);
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .w-cat {
    font-size: 0.6875rem;
    color: var(--text-dim);
  }
  .w-city {
    font-family: var(--font-serif);
    color: var(--text-heading);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .span-note {
    font-size: 0.6875rem;
    color: var(--text-faint);
    line-height: 1.6;
    margin-bottom: 1rem;
  }
</style>
