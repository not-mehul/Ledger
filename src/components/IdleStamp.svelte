<script lang="ts">
  // Ledger's idle toy: a passport stamp. Each press inks a city with today's
  // date; fill the page with eight and it is an easter egg.
  import { play } from 'dusk-dawn';
  import { cheer, hatch } from '../lib/delight';
  import { locale, t } from '../i18n/index.svelte';

  const CITIES = ['Lisboa', 'Kyōto', 'Marrakech', 'Reykjavík', 'Buenos Aires', 'Hà Nội', 'İstanbul', 'Cape Town'];

  let stamps = $state(0);
  let pressing = $state(false);
  let toy = $state<HTMLButtonElement>();
  const city = $derived(stamps === 0 ? undefined : CITIES[(stamps - 1) % CITIES.length]);
  // A stamp is never quite straight.
  const tilt = $derived(stamps === 0 ? 0 : (((stamps * 37) % 13) - 6) * 1.1);
  const date = $derived(new Date().toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase());

  function stamp() {
    stamps += 1;
    pressing = false;
    requestAnimationFrame(() => (pressing = true));
    if (stamps === CITIES.length) {
      play(toy, 'tada');
      cheer(toy, { count: 36, spread: 0.6 });
      hatch('stamps', t('egg.stamps'));
    }
  }
</script>

<button type="button" class="idle-toy" class:is-pressing={pressing} bind:this={toy} aria-label={t('idle.stamp')} onclick={stamp} onanimationend={() => (pressing = false)}>
  <!-- Lucide "stamp" -->
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <g class="stamp">
      <path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77Z" />
      <path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13" />
    </g>
    <path d="M5 22h14" />
  </svg>
</button>
<div class="idle-line" aria-live="polite">
  {#if city}
    {#key stamps}
      <p class="impression" style:--tilt="{tilt}deg">
        <span class="city">{city}</span>
        <span class="date">{date}</span>
      </p>
    {/key}
  {:else}
    {t('idle.hint')}
  {/if}
</div>

<style>
  .stamp {
    transform-box: view-box;
    transform-origin: 12px 18px;
  }
  .impression {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    margin: 0;
    padding: var(--space-1) var(--space-3);
    border: 1.5px solid currentColor;
    border-radius: var(--corner-sm);
    outline: 1px solid currentColor;
    outline-offset: 2px;
    color: var(--accent-amber);
    font-family: var(--font-mono);
    font-style: normal;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    transform: rotate(var(--tilt));
  }
  .city {
    font-size: 0.875rem;
    font-weight: 600;
  }
  .date {
    font-size: 0.6875rem;
    color: var(--text-dim);
  }
  @media (prefers-reduced-motion: no-preference) {
    /* The stamp comes down and gives; the impression lands where it struck. */
    .is-pressing .stamp {
      animation: press 420ms var(--ease-standard);
    }
    .impression {
      animation: ink var(--spring-spatial-fast-dur) var(--spring-spatial-fast) 120ms both;
    }
  }
  @keyframes press {
    35% {
      transform: translateY(3px) scale(1.06, 0.9);
    }
  }
  @keyframes ink {
    from {
      opacity: 0;
      transform: rotate(var(--tilt)) scale(1.25);
    }
  }
</style>
