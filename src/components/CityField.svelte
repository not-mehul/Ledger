<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import { describe, loadPlaces, searchPlaces, type Place, type PlaceIndex } from '../lib/places';

  interface Props {
    city: string;
    /** Called when the user picks a suggestion. */
    onpick: (place: Place) => void;
    /** Called when the user edits the text (any picked place no longer applies). */
    ontype: () => void;
  }

  let { city = $bindable(), onpick, ontype }: Props = $props();

  let index = $state.raw<PlaceIndex | null>(null);
  let focused = $state(false);
  let active = $state(-1);
  let dismissed = $state(false);

  const suggestions = $derived(index && focused && !dismissed ? searchPlaces(index, city) : []);
  const open = $derived(suggestions.length > 0);

  function ensureIndex() {
    if (!index) loadPlaces().then((i) => (index = i)).catch((err) => console.warn('Places unavailable:', err));
  }

  function pick(place: Place) {
    city = place.name;
    dismissed = true;
    active = -1;
    onpick(place);
  }

  function onkeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % suggestions.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + suggestions.length) % suggestions.length;
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(suggestions[active]!);
    } else if (e.key === 'Escape') {
      dismissed = true;
    }
  }
</script>

<div class="city-field">
  <input
    type="text"
    class="field-input"
    id="inputCity"
    placeholder={t('form.cityPlaceholder')}
    autocomplete="off"
    enterkeyhint="next"
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={open}
    aria-controls="citySuggestions"
    aria-activedescendant={active >= 0 ? `city-opt-${active}` : undefined}
    bind:value={city}
    onfocus={() => {
      focused = true;
      ensureIndex();
    }}
    onblur={() => setTimeout(() => (focused = false), 150)}
    oninput={() => {
      dismissed = false;
      active = -1;
      ontype();
    }}
    {onkeydown}
  />
  {#if open}
    <ul class="suggestions" id="citySuggestions" role="listbox">
      {#each suggestions as place, i (`${place.rank}`)}
        <li
          id="city-opt-{i}"
          role="option"
          aria-selected={i === active}
          class:active={i === active}
          onpointerdown={(e) => {
            e.preventDefault();
            pick(place);
          }}
        >
          <span class="name">{place.name}</span>
          <span class="where">{describe(place)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .city-field {
    position: relative;
  }
  .suggestions {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 120;
    list-style: none;
    background: rgba(var(--ink-rgb), 0.97);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
    overflow: hidden;
  }
  li {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.6rem 0.875rem;
    cursor: pointer;
  }
  li + li {
    border-top: 1px solid var(--border-subtle);
  }
  li.active,
  li:hover {
    background: rgba(var(--amber-rgb), 0.12);
  }
  .name {
    color: var(--text-high);
    font-size: 0.9375rem;
  }
  .where {
    color: var(--text-label);
    font-size: 0.6875rem;
    letter-spacing: 0.06em;
  }
</style>
