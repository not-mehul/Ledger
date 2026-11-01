<script lang="ts">
  // A field shaped like a text input that opens a picker (style.md §8.6). The
  // value only changes when Choose is pressed.
  import { locale, t } from '../i18n/index.svelte';
  import { formatMonth, parseMonth, toMonthString } from '../lib/dates';
  import Modal from './ui/Modal.svelte';

  interface Props {
    /** "YYYY-MM" */
    value: string;
  }

  let { value = $bindable() }: Props = $props();

  let open = $state(false);
  let viewYear = $state(new Date().getFullYear());
  let draft = $state<{ year: number; monthIndex: number } | null>(null);

  const months = $derived(
    Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(locale(), { month: 'short' })),
  );
  const now = new Date();

  function show() {
    const selected = parseMonth(value);
    draft = selected ? { year: selected.year, monthIndex: selected.monthIndex } : null;
    viewYear = selected?.year ?? now.getFullYear();
    open = true;
  }

  function choose() {
    if (draft) value = toMonthString(draft.year, draft.monthIndex);
    open = false;
  }
</script>

<button
  type="button"
  class="picker-field"
  id="inputDate"
  data-value={value}
  aria-haspopup="dialog"
  aria-expanded={open}
  onclick={show}
>
  {formatMonth(value, locale())}
</button>

{#if open}
  <Modal title={t('form.chooseMonth')} closeLabel={t('action.close')} onclose={() => (open = false)}>
    <div class="year-nav">
      <button type="button" class="btn-icon" id="dpPrevYear" aria-label={t('form.prevYear')} onclick={() => viewYear--}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <p class="t-card-title" aria-live="polite">{viewYear}</p>
      <button type="button" class="btn-icon" id="dpNextYear" aria-label={t('form.nextYear')} onclick={() => viewYear++}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
    <div class="hairline-grid month-grid" id="dpGrid">
      {#each months as name, idx (idx)}
        {@const isSelected = draft?.year === viewYear && draft.monthIndex === idx}
        <button
          type="button"
          class:current={now.getFullYear() === viewYear && now.getMonth() === idx}
          data-month={idx}
          aria-pressed={isSelected}
          onclick={() => (draft = { year: viewYear, monthIndex: idx })}>{name}</button
        >
      {/each}
    </div>
    <div class="btn-row">
      <button type="button" class="btn btn-muted" onclick={() => (open = false)}>{t('action.cancel')}</button>
      <button type="button" class="btn btn-primary" id="dpChoose" disabled={!draft} onclick={choose}>{t('form.choose')}</button>
    </div>
  </Modal>
{/if}
