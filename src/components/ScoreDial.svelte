<script lang="ts">
  import { scoreTier } from '../domain/score';

  interface Props {
    score: number | null;
    size?: number;
    stroke?: number;
    /** Show the number inside the ring. */
    labelled?: boolean;
    label?: string;
  }

  let { score, size = 88, stroke = 5.5, labelled = false, label }: Props = $props();

  const CIRC = 2 * Math.PI * 40;
  const offset = $derived(score === null ? CIRC : CIRC - (score / 100) * CIRC);
  const color = $derived(score === null ? 'var(--amber)' : `var(${scoreTier(score).cssVar})`);
</script>

<svg
  class="score-dial"
  width={size}
  height={size}
  viewBox="0 0 100 100"
  fill="none"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  <circle cx="50" cy="50" r="40" style="stroke: rgba(var(--line-rgb), 0.25)" stroke-width={stroke} />
  <circle
    cx="50"
    cy="50"
    r="40"
    style:stroke={color}
    stroke-width={stroke}
    stroke-dasharray={CIRC}
    stroke-dashoffset={offset}
    stroke-linecap="round"
    transform="rotate(-90 50 50)"
    class="arc"
  />
  {#if labelled && score !== null}
    <text x="50" y="57" text-anchor="middle" font-size="22" style:font-family="var(--mono)" style:fill={color}
      >{Math.round(score)}</text
    >
  {/if}
</svg>

<style>
  .score-dial {
    flex-shrink: 0;
  }
  .arc {
    transition:
      stroke-dashoffset 0.5s ease,
      stroke 0.5s ease;
  }
</style>
