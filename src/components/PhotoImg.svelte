<script lang="ts">
  import { photoUrl, type PhotoVariant } from '../data/photo-store';

  interface Props {
    id: string;
    variant?: PhotoVariant;
    alt: string;
    class?: string;
  }

  let { id, variant = 'thumb', alt, class: className = '' }: Props = $props();
  let src = $state<string | null>(null);

  $effect(() => {
    let cancelled = false;
    photoUrl(id, variant)
      .then((url) => {
        if (!cancelled) src = url;
      })
      .catch(() => (src = null));
    return () => (cancelled = true);
  });
</script>

{#if src}
  <img {src} {alt} class={className} loading="lazy" decoding="async" draggable="false" />
{:else}
  <span class="photo-placeholder {className}" role="img" aria-label={alt}></span>
{/if}

<style>
  .photo-placeholder {
    display: block;
    background: var(--panel-bg-faint);
  }
</style>
