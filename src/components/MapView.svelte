<script lang="ts">
  import Icon from './ui/Icon.svelte';
  import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from 'd3-geo';
  import { select } from 'd3-selection';
  import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
  import type { Feature, FeatureCollection, Geometry } from 'geojson';
  import { feature } from 'topojson-client';
  import type { Topology } from 'topojson-specification';
  import type { Entry } from '../domain/entry';
  import { scoreTier } from '../domain/score';
  import { t } from '../i18n/index.svelte';
  import { loadPlaces, matchPlace, type PlaceIndex } from '../lib/places';
  import { ledger, type Placement } from '../state/ledger.svelte';
  import { ui } from '../state/ui.svelte';
  import ScoreDial from './ScoreDial.svelte';

  type Country = Feature<Geometry, { name: string }> & { id?: string | number };

  let width = $state(0);
  // Phones get a taller frame: the world still fills the width, and the open
  // water above and below it leaves room for the zoom buttons.
  const height = $derived(Math.round(width * (width < 600 ? 0.8 : 0.56)));
  let countries = $state.raw<Country[]>([]);
  let places = $state.raw<PlaceIndex | null>(null);
  let transform = $state({ k: 1, x: 0, y: 0 });
  let selectedId = $state<string | null>(null);
  let svg = $state<SVGSVGElement>();
  let zoomer: ZoomBehavior<SVGSVGElement, unknown> | undefined;

  const SPHERE: GeoPermissibleObjects = { type: 'Sphere' };
  const projection = $derived(width ? geoNaturalEarth1().fitSize([width, height], SPHERE) : null);
  const path = $derived(projection ? geoPath(projection) : null);

  const located = $derived(ledger.entries.filter((e) => e.lat !== undefined && e.lon !== undefined));
  const unplaced = $derived(ledger.entries.length - located.length);
  const visitedIso = $derived(new Set(ledger.entries.map((e) => e.country).filter(Boolean)));
  const selected = $derived(selectedId ? ledger.find(selectedId) : undefined);

  function isoOf(c: Country): string | undefined {
    return places?.numericToIso.get(Number(c.id));
  }

  // Load shapes and the place index once the tab is shown.
  $effect(() => {
    void import('world-atlas/countries-110m.json').then((m) => {
      const topo = (m.default ?? m) as unknown as Topology;
      countries = (feature(topo, topo.objects.countries!) as FeatureCollection<Geometry, { name: string }>).features as Country[];
    });
    loadPlaces()
      .then((p) => (places = p))
      .catch((err) => console.warn('Places unavailable:', err));
  });

  // Place older or hand-typed entries using the city list. Only the
  // coordinates are applied, to the latest copy of each entry, so this can
  // never undo an edit or a sync that lands meanwhile.
  let placing = false;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a cache of misses, not state
  const unplaceable = new Set<string>();
  $effect(() => {
    const index = places;
    if (!index || placing || ledger.status !== 'ready') return;
    const found: Placement[] = [];
    for (const e of ledger.entries) {
      if (e.lat !== undefined || unplaceable.has(`${e.city}|${e.state}`)) continue;
      const p = matchPlace(index, e.city, e.state);
      if (p) found.push({ id: e.id, country: p.country, lat: p.lat, lon: p.lon });
      else unplaceable.add(`${e.city}|${e.state}`);
    }
    if (!found.length) return;
    placing = true;
    void ledger.placeEntries(found).catch((err: unknown) => console.warn('Placing entries failed:', err)).finally(() => (placing = false));
  });

  $effect(() => {
    if (!svg || !width) return;
    zoomer = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 16])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .on('zoom', (e: { transform: { k: number; x: number; y: number } }) => {
        transform = { k: e.transform.k, x: e.transform.x, y: e.transform.y };
      });
    const sel = select(svg);
    sel.call(zoomer).call(zoomer.transform, zoomIdentity);
    return () => {
      sel.on('.zoom', null);
    };
  });

  function zoomBy(factor: number) {
    if (svg && zoomer) select(svg).call(zoomer.scaleBy, factor);
  }

  function reset() {
    if (svg && zoomer) select(svg).call(zoomer.transform, zoomIdentity);
    selectedId = null;
  }

  function dotColor(e: Entry): string {
    const s = ledger.scoreOf(e);
    return s === null ? 'var(--accent-amber)' : `var(${scoreTier(s).cssVar})`;
  }
</script>

<div id="viewMap" role="tabpanel" aria-labelledby="tabMap">
  <div class="logbook-header">
    <h2>{t('map.title')}</h2>
    <span class="logbook-count">
      {t('map.cities', { count: located.length })} · {t('map.countries', { count: visitedIso.size })}
    </span>
  </div>

  <div class="map-frame panel" bind:clientWidth={width}>
    {#if path && countries.length}
      <svg bind:this={svg} {width} {height} viewBox="0 0 {width} {height}" class="map" role="group" aria-label={t('map.title')}>
        <rect {width} {height} class="sea" />
        <g transform="translate({transform.x} {transform.y}) scale({transform.k})">
          <path d={path(SPHERE)} class="sphere" />
          {#each countries as c, i (i)}
            {@const iso = isoOf(c)}
            <path d={path(c)} class="country" class:visited={iso && visitedIso.has(iso)} style:stroke-width={0.5 / transform.k}>
              <title>{c.properties.name}</title>
            </path>
          {/each}
          {#each located as e, n (e.id)}
            {@const pt = projection!([e.lon!, e.lat!])}
            {#if pt}
              {#if selectedId === e.id}
                <circle cx={pt[0]} cy={pt[1]} r={14 / transform.k} class="halo" style:stroke-width={0.75 / transform.k} aria-hidden="true" />
              {/if}
              <!-- A 10px pin with a 44px touch target around it (style.md §14). -->
              <g
                class="pin"
                role="button"
                tabindex="0"
                aria-label="{e.city}, {e.state}"
                aria-pressed={selectedId === e.id}
                onclick={() => (selectedId = e.id)}
                onkeydown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    selectedId = e.id;
                  }
                }}
              >
                <circle cx={pt[0]} cy={pt[1]} r={22 / transform.k} class="hit" style:stroke-width={2 / transform.k} />
                <circle
                  cx={pt[0]}
                  cy={pt[1]}
                  r={(selectedId === e.id ? 7 : 5) / transform.k}
                  class="dot"
                  class:selected={selectedId === e.id}
                  style:fill={dotColor(e)}
                  style:stroke-width={1.5 / transform.k}
                  style:--n={Math.min(n, 12)}
                />
              </g>
            {/if}
          {/each}
        </g>
      </svg>
    {:else}
      <div class="map-loading" style:height="{height || 200}px">{t('map.loading')}</div>
    {/if}
  </div>
  {#if path && countries.length}
    <!-- Below the map, so they never cover a country or a pin. -->
    <div class="map-controls">
        <button type="button" class="dp-nav-btn" aria-label={t('map.zoomIn')} onclick={() => zoomBy(1.6)}><Icon name="plus" /></button>
        <button type="button" class="dp-nav-btn" aria-label={t('map.zoomOut')} onclick={() => zoomBy(1 / 1.6)}><Icon name="minus" /></button>
        <button type="button" class="dp-nav-btn" aria-label={t('map.reset')} onclick={reset}><Icon name="reset" /></button>
    </div>
  {/if}

  {#if selected}
    {@const score = ledger.scoreOf(selected)}
    <div class="panel map-selected">
      <ScoreDial {score} size={56} stroke={6} labelled />
      <div class="info">
        <div class="entry-city-name">{selected.city}<span class="entry-region">, {selected.state}</span></div>
        <button type="button" class="btn btn-secondary" onclick={() => ui.showInLedger(selected.id)}>{t('map.open')}</button>
      </div>
    </div>
  {/if}

  {#if !ledger.entries.length}
    <p class="map-note">{t('map.empty')}</p>
  {:else}
    {#if !selected && located.length}
      <p class="map-hint">{t('map.hint')}</p>
    {/if}
    {#if unplaced > 0}
      <p class="map-note">{t('map.unplaced', { count: unplaced })}</p>
    {/if}
  {/if}
</div>

<style>
  .map-frame {
    position: relative;
    padding: 0;
    overflow: hidden;
    touch-action: none;
  }
  .map {
    display: block;
    cursor: grab;
  }
  .sea {
    fill: var(--map-water);
    opacity: 0.6;
  }
  .sphere {
    fill: var(--map-water);
  }
  .country {
    fill: var(--map-land);
    stroke: var(--bg-grad-mid);
  }
  .country.visited {
    fill: var(--map-visited);
  }
  .pin {
    cursor: pointer;
    outline: none;
  }
  .hit {
    fill: transparent;
    stroke: none;
  }
  .pin:focus-visible .hit {
    stroke: var(--focus-ring);
  }
  .dot {
    stroke: var(--bg-grad-mid);
  }
  .dot.selected {
    stroke: var(--text-strong);
  }
  /* Opening the map, the pins land one after another (35ms apart, capped at
     twelve, as any list arrives); a selected pin's halo rings out once. */
  @media (prefers-reduced-motion: no-preference) {
    .dot {
      transform-box: fill-box;
      transform-origin: center;
      animation: pin-land var(--spring-spatial-slow-dur) var(--spring-spatial-slow) both;
      animation-delay: calc(var(--n) * 35ms);
    }
    .halo {
      transform-box: fill-box;
      transform-origin: center;
      animation: halo-ring var(--spring-spatial-fast-dur) var(--spring-spatial-fast) both;
    }
  }
  @keyframes pin-land {
    from {
      opacity: 0;
      transform: scale(0);
    }
  }
  @keyframes halo-ring {
    from {
      opacity: 0;
      transform: scale(0.4);
    }
  }
  .map-controls {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .map-controls button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius);
    cursor: pointer;
    background: var(--modal-bg);
    color: var(--text-dim);
    transition: color var(--dur-hover);
  }
  .map-controls button:hover {
    color: var(--text-heading);
  }
  /* A soft ring around the chosen city. */
  .halo {
    fill: rgba(var(--accent-amber-rgb), 0.18);
    stroke: rgba(var(--accent-amber-rgb), 0.5);
    pointer-events: none;
    animation: fade-in var(--dur-settle) var(--ease-settle);
  }
  .map-selected {
    animation: settle-in var(--dur-settle) var(--ease-settle);
  }
  .map-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-faint);
    font-size: 0.75rem;
  }
  .map-selected {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
    align-items: flex-start;
  }
  .map-note,
  .map-hint {
    font-size: 0.75rem;
    color: var(--text-dim);
    line-height: 1.6;
    margin-top: 0.5rem;
  }
</style>
