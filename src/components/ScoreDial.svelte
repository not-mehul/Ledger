<script lang="ts">
  import { scoreTier } from '../domain/score';

  interface Props {
    score: number | null;
    size?: number;
    stroke?: number;
    /** Show the number inside the ring. */
    labelled?: boolean;
    label?: string;
    /** Hairline marks just outside the arc where each score tier begins. */
    ticks?: boolean;
  }

  let { score, size = 88, stroke = 5.5, labelled = false, label, ticks = false }: Props = $props();

  // A 270° arc, open at the bottom (style.md §8.15).
  const CIRC = 2 * Math.PI * 40;
  const ARC = CIRC * 0.75;
  const offset = $derived(score === null ? ARC : ARC - (score / 100) * ARC);
  /** Tier thresholds (domain/score.ts), as marks along the 270° arc. */
  const TIER_MARKS = [42, 58, 72, 85].map((s) => {
    const a = ((135 + (s / 100) * 270) * Math.PI) / 180;
    return { s, x1: 50 + 45.5 * Math.cos(a), y1: 50 + 45.5 * Math.sin(a), x2: 50 + 49 * Math.cos(a), y2: 50 + 49 * Math.sin(a) };
  });
  const color = $derived(score === null ? 'var(--accent-amber)' : `var(${scoreTier(score).cssVar})`);
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
  <circle
    cx="50"
    cy="50"
    r="40"
    style="stroke: var(--chart-track)"
    stroke-width={stroke}
    stroke-dasharray="{ARC} {CIRC}"
    stroke-linecap="round"
    transform="rotate(135 50 50)"
  />
  <circle
    cx="50"
    cy="50"
    r="40"
    style:stroke={color}
    stroke-width={stroke}
    stroke-dasharray="{ARC} {CIRC}"
    stroke-dashoffset={offset}
    stroke-linecap="round"
    transform="rotate(135 50 50)"
    class="arc"
  />
  {#if ticks}
    {#each TIER_MARKS as m (m.s)}
      <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} class="tick" class:reached={score !== null && score >= m.s} />
    {/each}
  {/if}
  {#if labelled && score !== null}
    <text x="50" y="58" text-anchor="middle" font-size="26" style:font-family="var(--font-serif)" style:fill="var(--text-heading)" class="tabular"
      >{Math.round(score)}</text
    >
  {/if}
</svg>

<style>
  .score-dial {
    flex-shrink: 0;
  }
  .tick {
    stroke: var(--text-faint);
    stroke-width: 1.25;
    stroke-linecap: round;
    transition: stroke var(--spring-effects-default-dur) var(--spring-effects-default);
  }
  .tick.reached {
    stroke: var(--accent-amber);
  }
  .arc {
    transition:
      stroke-dashoffset var(--spring-spatial-slow-dur) var(--spring-spatial-slow),
      stroke var(--spring-effects-default-dur) var(--spring-effects-default);
  }
</style>
