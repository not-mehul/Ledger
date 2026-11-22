<script lang="ts">
  import { ICONS, type IconName } from '../../domain/icons';

  interface Props {
    name: IconName;
    size?: number;
    /** Extra classes, for the shared styles that place an icon (e.g. "notice-chevron"). */
    class?: string;
  }

  let { name, size = 16, class: extra = '' }: Props = $props();
</script>

<svg class="icon {extra}" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#each ICONS[name] as [tag, attrs], i (i)}
    <svelte:element this={tag} {...attrs} />
  {/each}
</svg>

<style>
  .icon {
    flex-shrink: 0;
  }
</style>
