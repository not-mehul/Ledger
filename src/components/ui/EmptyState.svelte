<script lang="ts">
  // style.md §8.14, "Nothing here yet": a dashed panel, an icon, a title, one
  // line on what goes here, and one button to add the first one.
  interface Props {
    icon: 'map-pin' | 'chart' | 'map';
    title: string;
    text: string;
    action?: string;
    onaction?: () => void;
  }

  let { icon, title, text, action, onaction }: Props = $props();

  const PATHS: Record<Props['icon'], string[]> = {
    'map-pin': [
      'M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0',
      'M12 7a3 3 0 1 0 0 6 3 3 0 1 0 0-6'
    ],
    chart: ['M3 3v16a2 2 0 0 0 2 2h16', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
    map: [
      'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z',
      'M15 5.764v15',
      'M9 3.236v15'
    ]
  };
</script>

<div class="empty-state">
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {#each PATHS[icon] as d (d)}<path {d} />{/each}
  </svg>
  <p class="empty-title">{title}</p>
  <p class="empty-text">{text}</p>
  {#if action && onaction}
    <button type="button" class="btn btn-secondary" onclick={onaction}>{action}</button>
  {/if}
</div>
