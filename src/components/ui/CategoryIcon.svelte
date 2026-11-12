<script lang="ts">
  import { categoryIcon } from '../../domain/icons';
  import type { Category } from '../../domain/metrics';
  import Icon from './Icon.svelte';

  interface Props {
    category: Category;
    size?: number;
  }

  let { category, size = 16 }: Props = $props();
</script>

<span class="cat-icon"><Icon name={categoryIcon(category)} {size} /></span>

<style>
  /* An icon tint is one of the accent's few jobs (style.md §1.3). */
  .cat-icon {
    display: inline-flex;
    color: var(--accent-amber);
    vertical-align: -0.125em;
  }
</style>
