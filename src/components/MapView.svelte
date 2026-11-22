<script lang="ts">
  import Icon from './ui/Icon.svelte';
  import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from 'd3-geo';
  import { select } from 'd3-selection';
  import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
  import { untrack } from 'svelte';
  import type { Feature, FeatureCollection, Geometry } from 'geojson';
  import { feature } from 'topojson-client';
  import type { Topology } from 'topojson-specification';
  import type { Entry } from '../domain/entry';
  import { scoreTier } from '../domain/score';
  import { locale, t } from '../i18n/index.svelte';
  import { loadPlaces, matchPlace, type PlaceIndex } from '../lib/places';
  import { ledger, type Placement } from '../state/ledger.svelte';
  import { ui } from '../state/ui.svelte';
  import ScoreDial from './ScoreDial.svelte';

  type Country = Feature<Geometry, { name: string }> & { id?: string | number };

  let width = $state(0);
  // Phones get a taller frame: the map opens fitted to your cities, so the
  // extra height shows land rather than open water.
  const height = $derived(Math.round(width * (width < 600 ? 0.9 : 0.56)));
  let countries = $state.raw<Country[]>([]);
  let places = $state.raw<PlaceIndex | null>(null);
  let transform = $state({ k: 1, x: 0, y: 0 });
  /** The pin or group chosen: one city, or several that sit on top of each other. */
  let selectedIds = $state<string[]>([]);
  const selectedId = $derived(selectedIds.length === 1 ? selectedIds[0]! : null);
  /** Once you pan or zoom, the map stops refitting itself as cities arrive. */
  let moved = false;
  let svg = $state<SVGSVGElement>();
  let zoomer: ZoomBehavior<SVGSVGElement, unknown> | undefined;

  const SPHERE: GeoPermissibleObjects = { type: 'Sphere' };
  const projection = $derived(width ? geoNaturalEarth1().fitSize([width, height], SPHERE) : null);
  const path = $derived(projection ? geoPath(projection) : null);

  const located = $derived(ledger.entries.filter((e) => e.lat !== undefined && e.lon !== undefined));
  const unplaced = $derived(ledger.entries.length - located.length);
  const visitedIso = $derived(new Set(ledger.entries.map((e) => e.country).filter(Boolean)));
  const selected = $derived(selectedId ? ledger.find(selectedId) : undefined);
  const selectedGroup = $derived(selectedIds.length > 1 ? selectedIds.map((id) => ledger.find(id)).filter((e): e is Entry => !!e) : []);

  /** Each located entry at its spot on the unzoomed map. */
  const points = $derived.by(() => {
    if (!projection) return [];
    const out: { e: Entry; x: number; y: number }[] = [];
    for (const e of located) {
      const pt = projection([e.lon!, e.lat!]);
      if (pt) out.push({ e, x: pt[0], y: pt[1] });
    }
    return out;
  });

  // Pins closer than this on screen merge into one numbered group, so none
  // hides another and every touch target stays whole.
  const GROUP_PX = 26;
  interface Group {
    x: number;
    y: number;
    members: { e: Entry; x: number; y: number }[];
  }
  const groups = $derived.by(() => {
    const reach = GROUP_PX / transform.k;
    const out: Group[] = [];
    for (const p of points) {
      const near = out.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < reach);
      if (near) {
        near.members.push(p);
        near.x = near.members.reduce((a, m) => a + m.x, 0) / near.members.length;
        near.y = near.members.reduce((a, m) => a + m.y, 0) / near.members.length;
      } else out.push({ x: p.x, y: p.y, members: [p] });
    }
    return out;
  });

  const regionNames = $derived(new Intl.DisplayNames([locale()], { type: 'region' }));
  function countryName(iso: string): string {
    try {
      return regionNames.of(iso) ?? iso;
    } catch {
      return iso;
    }
  }
  /** Visited countries, most cities first. */
  const countryList = $derived.by(() => {
    const by: Record<string, Entry[]> = {};
    for (const e of ledger.entries) if (e.country) (by[e.country] ??= []).push(e);
    return Object.entries(by)
      .map(([iso, entries]) => ({ iso, name: countryName(iso), entries }))
      .sort((a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name, locale()));
  });

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

  const MAX_ZOOM = 16;
  /** The view that frames these spots with a margin. Opening the map stops at 6×, so one city still shows its region. */
  function fitTo(spots: { x: number; y: number }[], maxK = 6): ZoomTransform {
    if (!spots.length) return zoomIdentity;
    const xs = spots.map((p) => p.x);
    const ys = spots.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 40;
    const k = Math.max(1, Math.min(maxK, (width - 2 * pad) / Math.max(x1 - x0, 1), (height - 2 * pad) / Math.max(y1 - y0, 1)));
    return zoomIdentity.translate(width / 2 - ((x0 + x1) / 2) * k, height / 2 - ((y0 + y1) / 2) * k).scale(k);
  }
  function show(view: ZoomTransform) {
    if (svg && zoomer) select(svg).call(zoomer.transform, view);
  }

  $effect(() => {
    if (!svg || !width) return;
    zoomer = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .on('zoom', (e: { transform: { k: number; x: number; y: number }; sourceEvent: unknown }) => {
        if (e.sourceEvent) moved = true;
        transform = { k: e.transform.k, x: e.transform.x, y: e.transform.y };
      });
    const sel = select(svg);
    sel.call(zoomer).call(zoomer.transform, untrack(() => fitTo(points)));
    return () => {
      sel.on('.zoom', null);
    };
  });

  // Cities placed after the map opened (by name, or by a sync) join the view,
  // until you move the map yourself.
  $effect(() => {
    const spots = points;
    if (!moved && zoomer) untrack(() => show(fitTo(spots)));
  });

  function zoomBy(factor: number) {
    moved = true;
    if (svg && zoomer) select(svg).call(zoomer.scaleBy, factor);
  }

  /** Back to the view that frames all your cities. */
  function reset() {
    moved = false;
    show(fitTo(points));
    selectedIds = [];
  }

  /** A group opens into its cities; ones too close to ever separate are listed instead. */
  function openGroup(g: Group) {
    const view = fitTo(g.members, MAX_ZOOM);
    const spread = Math.max(...g.members.map((m) => Math.hypot(m.x - g.x, m.y - g.y)));
    if (spread * MAX_ZOOM < GROUP_PX / 2 || view.k <= transform.k * 1.05) {
      selectedIds = g.members.map((m) => m.e.id);
    } else {
      moved = true;
      show(view);
      selectedIds = [];
    }
  }

  function showCountry(entries: Entry[]) {
    const spots = points.filter((p) => entries.includes(p.e));
    if (!spots.length) return;
    moved = true;
    show(fitTo(spots));
    selectedIds = spots.length === 1 ? [spots[0]!.e.id] : [];
    svg?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function activate(ev: KeyboardEvent, run: () => void) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      run();
    }
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
          {#each groups as g, n (g.members[0]!.e.id)}
            {#if g.members.length === 1}
              {@const e = g.members[0]!.e}
              {#if selectedId === e.id}
                <circle cx={g.x} cy={g.y} r={14 / transform.k} class="halo" style:stroke-width={0.75 / transform.k} aria-hidden="true" />
              {/if}
              <!-- A 10px pin with a 44px touch target around it (style.md §14). -->
              <g
                class="pin"
                role="button"
                tabindex="0"
                aria-label="{e.city}, {e.state}"
                aria-pressed={selectedId === e.id}
                onclick={() => (selectedIds = [e.id])}
                onkeydown={(ev) => activate(ev, () => (selectedIds = [e.id]))}
              >
                <circle cx={g.x} cy={g.y} r={22 / transform.k} class="hit" style:stroke-width={2 / transform.k} />
                <circle
                  cx={g.x}
                  cy={g.y}
                  r={(selectedId === e.id ? 7 : 5) / transform.k}
                  class="dot"
                  class:selected={selectedId === e.id}
                  style:fill={dotColor(e)}
                  style:stroke-width={1.5 / transform.k}
                  style:--n={Math.min(n, 12)}
                />
              </g>
            {:else}
              {@const open = g.members.length === selectedIds.length && g.members.every((m) => selectedIds.includes(m.e.id))}
              <g
                class="pin group"
                role="button"
                tabindex="0"
                aria-label={t('map.group', { count: g.members.length, cities: g.members.map((m) => m.e.city).join(', ') })}
                aria-pressed={open}
                onclick={() => openGroup(g)}
                onkeydown={(ev) => activate(ev, () => openGroup(g))}
              >
                <circle cx={g.x} cy={g.y} r={22 / transform.k} class="hit" style:stroke-width={2 / transform.k} />
                <circle cx={g.x} cy={g.y} r={11 / transform.k} class="bubble" class:selected={open} style:stroke-width={1.5 / transform.k} style:--n={Math.min(n, 12)} />
                <text x={g.x} y={g.y} class="count" style:font-size="{11 / transform.k}px" aria-hidden="true">{g.members.length}</text>
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
      {#if !selected && !selectedGroup.length && located.length}
        <p class="map-hint">{t('map.hint')}</p>
      {/if}
      <button type="button" class="dp-nav-btn" aria-label={t('map.zoomIn')} onclick={() => zoomBy(1.6)}><Icon name="plus" /></button>
      <button type="button" class="dp-nav-btn" aria-label={t('map.zoomOut')} onclick={() => zoomBy(1 / 1.6)}><Icon name="minus" /></button>
      <button type="button" class="dp-nav-btn" aria-label={t('map.reset')} title={t('map.reset')} onclick={reset}><Icon name="reset" /></button>
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
  {:else if selectedGroup.length}
    <div class="panel map-selected map-group">
      <h3 class="t-section-label">{t('map.groupTitle', { count: selectedGroup.length })}</h3>
      <div class="settings-group">
        {#each selectedGroup as e (e.id)}
          <button type="button" class="settings-row" onclick={() => ui.showInLedger(e.id)}>
            <ScoreDial score={ledger.scoreOf(e)} size={36} stroke={4} />
            <span class="settings-row-text">
              <span class="settings-row-title">{e.city}</span>
              <span class="settings-row-hint">{e.state}</span>
            </span>
            <Icon name="chevronRight" class="settings-row-chevron" />
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if !ledger.entries.length}
    <p class="map-note">{t('map.empty')}</p>
  {:else if unplaced > 0}
    <p class="map-note">{t('map.unplaced', { count: unplaced })}</p>
  {/if}

  {#if countryList.length}
    <section class="panel countries" aria-labelledby="countriesTitle">
      <div class="section-head"><h2 id="countriesTitle">{t('map.countriesTitle')}</h2></div>
      <div class="settings-group">
        {#each countryList as c (c.iso)}
          <button type="button" class="settings-row" data-country={c.iso} onclick={() => showCountry(c.entries)}>
            <span class="settings-row-text">
              <span class="settings-row-title">{c.name}</span>
              <span class="settings-row-hint">{c.entries.map((e) => e.city).join(', ')}</span>
            </span>
            <span class="settings-row-value">{c.entries.length}</span>
          </button>
        {/each}
      </div>
    </section>
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
  .bubble {
    fill: var(--accent-amber);
    stroke: var(--bg-grad-mid);
  }
  .bubble.selected {
    stroke: var(--text-strong);
  }
  .count {
    fill: var(--on-accent);
    font-family: var(--font-mono);
    font-weight: 600;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
  }
  /* Opening the map, the pins land one after another (35ms apart, capped at
     twelve, as any list arrives); a selected pin's halo rings out once. */
  @media (prefers-reduced-motion: no-preference) {
    .dot,
    .bubble {
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
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .map-controls .map-hint {
    flex: 1;
    min-width: 0;
    margin: 0;
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
  .map-group {
    display: block;
  }
  .map-group .t-section-label {
    margin: 0 0 0.25rem;
  }
  .countries {
    margin-top: 1rem;
  }
  .map-note,
  .map-hint {
    font-size: 0.75rem;
    color: var(--text-dim);
    line-height: 1.6;
    margin-top: 0.5rem;
  }
</style>
