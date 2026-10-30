<script lang="ts">
  import { locale, t } from '../i18n/index.svelte';
  import { formatMonth, parseMonth, toMonthString } from '../lib/dates';
  import { ui } from '../state/ui.svelte';

  interface Props {
    /** "YYYY-MM" */
    value: string;
  }

  let { value = $bindable() }: Props = $props();

  let open = $state(false);
  let viewYear = $state(new Date().getFullYear());
  let input: HTMLInputElement;
  let grid = $state<HTMLDivElement>();

  const selected = $derived(parseMonth(value));
  const months = $derived(
    Array.from({ length: 12 }, (_, i) =>
      new Date(2000, i, 1).toLocaleDateString(locale(), { month: 'short' }),
    ),
  );
  const now = new Date();

  function toggle() {
    if (open) {
      open = false;
      return;
    }
    viewYear = selected?.year ?? now.getFullYear();
    open = true;
    queueMicrotask(() => (grid?.querySelector<HTMLButtonElement>('.selected') ?? grid?.querySelector('button'))?.focus());
  }

  function choose(monthIndex: number) {
    value = toMonthString(viewYear, monthIndex);
    open = false;
    input.focus();
  }

  $effect(() => {
    if (!open) return;
    const release = ui.pushOverlay(() => (open = false));
    const onDocClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.dp-wrapper')) open = false;
    };
    document.addEventListener('click', onDocClick);
    return () => {
      release();
      document.removeEventListener('click', onDocClick);
    };
  });
</script>

<div class="dp-wrapper">
  <input
    bind:this={input}
    type="text"
    class="field-input field-input--date"
    id="inputDate"
    value={formatMonth(value, locale())}
    data-value={value}
    readonly
    role="combobox"
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-controls="dpPopup"
    onclick={toggle}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Escape') open = false;
    }}
  />
  <div
    class="dp-popup"
    class:open
    id="dpPopup"
    role="dialog"
    aria-label={t('form.chooseMonth')}
    tabindex="-1"
    onkeydown={(e) => {
      if (e.key === 'Escape') {
        open = false;
        input.focus();
      }
    }}
  >
    <div class="dp-header">
      <button type="button" class="dp-nav-btn" id="dpPrevYear" aria-label={t('form.prevYear')} onclick={() => viewYear--}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <div class="dp-month-year" aria-live="polite">{viewYear}</div>
      <button type="button" class="dp-nav-btn" id="dpNextYear" aria-label={t('form.nextYear')} onclick={() => viewYear++}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
    <div class="dp-grid" id="dpGrid" bind:this={grid}>
      {#each months as name, idx (idx)}
        {@const isSelected = selected?.year === viewYear && selected.monthIndex === idx}
        {@const isCurrent = now.getFullYear() === viewYear && now.getMonth() === idx}
        <button
          type="button"
          class="dp-month-btn"
          class:selected={isSelected}
          class:current={isCurrent && !isSelected}
          data-month={idx}
          aria-pressed={isSelected}
          onclick={() => choose(idx)}>{name}</button
        >
      {/each}
    </div>
  </div>
</div>
