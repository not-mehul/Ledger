<script lang="ts">
  import { Select } from 'dusk-dawn';
  import {
    WEIGHT_MAX,
    WEIGHT_MIN,
    WEIGHT_STEP,
    addCategory,
    addMetric,
    canRemoveMetric,
    hasActiveMetric,
    moveCategory,
    moveMetric,
    removeMetric,
    restoreDefaults,
    updateCategory,
    updateMetric,
    type Category,
    type Metric,
    type MetricConfig,
  } from '../domain/metrics';
  import { CATEGORY_ICONS, categoryIcon } from '../domain/icons';
  import { categoryName, metricEnds, metricName, t } from '../i18n/index.svelte';
  import { ledger } from '../state/ledger.svelte';
  import { ui } from '../state/ui.svelte';
  import Icon from './ui/Icon.svelte';
  import Sheet from './Sheet.svelte';

  const config = $derived(ledger.config);
  const WEIGHTS = Array.from({ length: (WEIGHT_MAX - WEIGHT_MIN) / WEIGHT_STEP + 1 }, (_, i) => WEIGHT_MIN + i * WEIGHT_STEP);
  const rated = $derived(new Set(ledger.entries.flatMap((e) => Object.keys(e.ratings))));

  class NothingVisible extends Error {}

  /** Edits are functions of the latest config, so rapid changes never clobber each other. */
  async function apply(edit: (c: MetricConfig) => MetricConfig) {
    try {
      await ledger.updateConfig((current) => {
        const next = edit(current);
        if (!hasActiveMetric(next)) throw new NothingVisible();
        return next;
      });
    } catch (err) {
      if (err instanceof NothingVisible) {
        ui.notify(t('metrics.keepOne'), 'error');
      } else {
        console.error('Saving metrics failed:', err);
        ui.notify(t('toast.saveFailed'), 'error');
      }
    }
  }

  const metricsOf = (cat: Category) => config.metrics.filter((m) => m.cat === cat.id);
  const builtinName = (m: Metric) => (m.builtin ? metricName({ ...m, label: undefined }) : '');
  const builtinEnds = (m: Metric) => metricEnds({ ...m, lo: undefined, hi: undefined });

  async function restore() {
    const ok = await ui.confirm({
      title: t('metrics.restoreTitle'),
      message: t('metrics.restoreMessage'),
      action: t('metrics.restore'),
      danger: true,
    });
    if (ok) await apply((c) => restoreDefaults(c));
  }

  // The list stays put; tapping a row opens that metric or category over it.
  let editing = $state<{ kind: 'metric' | 'category'; id: string } | null>(null);
  const editingMetric = $derived(editing?.kind === 'metric' ? config.metrics.find((m) => m.id === editing!.id) : undefined);
  const editingCategory = $derived(editing?.kind === 'category' ? config.categories.find((c) => c.id === editing!.id) : undefined);
  const close = () => (editing = null);

  async function addTo(cat: Category) {
    let id = '';
    await apply((c) => {
      const next = addMetric(c, cat.id, t('metrics.newMetric'));
      id = next.metrics.at(-1)!.id;
      return next;
    });
    // Straight to the new metric, so it can be named.
    if (config.metrics.some((m) => m.id === id)) editing = { kind: 'metric', id };
  }

  async function addCat() {
    let id = '';
    await apply((c) => {
      const next = addCategory(c, t('metrics.newCategory'));
      id = next.categories.at(-1)!.id;
      return next;
    });
    if (config.categories.some((c) => c.id === id)) editing = { kind: 'category', id };
  }

  async function remove(m: Metric) {
    editing = null;
    await apply((c) => removeMetric(c, m.id));
  }

  // Drag a row by its grip to reorder it within its category. Everyone else
  // (keyboard, screen readers) uses Move up / Move down in the metric's sheet.
  interface Drag {
    id: string;
    ids: string[];
    from: number;
    to: number;
    startY: number;
    mids: number[];
    height: number;
  }
  let drag = $state<Drag | null>(null);
  let dragDy = $state(0);

  function gripDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const grip = e.currentTarget as HTMLElement;
    const row = grip.closest<HTMLElement>('.metric-row')!;
    const rows = [...row.parentElement!.querySelectorAll<HTMLElement>(':scope > .metric-row')];
    const from = rows.indexOf(row);
    const boxes = rows.map((r) => r.getBoundingClientRect());
    drag = {
      id: row.dataset.metric!,
      ids: rows.map((r) => r.dataset.metric!),
      from,
      to: from,
      startY: e.clientY,
      mids: boxes.map((b) => b.top + b.height / 2),
      height: boxes[from]!.height,
    };
    grip.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function gripMove(e: PointerEvent) {
    if (!drag) return;
    const first = drag.mids[0]! - drag.mids[drag.from]!;
    const last = drag.mids.at(-1)! - drag.mids[drag.from]!;
    dragDy = Math.min(last, Math.max(first, e.clientY - drag.startY));
    const y = drag.mids[drag.from]! + dragDy;
    let to = drag.from;
    while (to < drag.mids.length - 1 && y > (drag.mids[to]! + drag.mids[to + 1]!) / 2) to++;
    while (to > 0 && y < (drag.mids[to]! + drag.mids[to - 1]!) / 2) to--;
    drag.to = to;
  }
  async function gripUp() {
    if (!drag) return;
    const { id, from, to } = drag;
    drag = null;
    dragDy = 0;
    if (to === from) return;
    const dir = to > from ? 1 : -1;
    await apply((c) => {
      let next = c;
      for (let k = 0; k < Math.abs(to - from); k++) next = moveMetric(next, id, dir);
      return next;
    });
  }
  /** How far a row slides to make room for the one being dragged. */
  function shiftOf(id: string): number {
    if (!drag) return 0;
    if (id === drag.id) return dragDy;
    const i = drag.ids.indexOf(id);
    if (i < 0) return 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.height;
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return drag.height;
    return 0;
  }
</script>

<p class="t-hint intro">{t('metrics.hint')}</p>

{#each config.categories as cat (cat.id)}
  {@const metrics = metricsOf(cat)}
  <section class="cat" class:archived={cat.archived} data-category={cat.id} aria-labelledby="cat-{cat.id}">
    <div class="cat-head">
      <span class="cat-icon"><Icon name={categoryIcon(cat)} size={20} /></span>
      <h3 class="cat-name" id="cat-{cat.id}">{categoryName(cat)}</h3>
      {#if cat.archived}<span class="tag">{t('metrics.hidden')}</span>{/if}
      <button
        type="button"
        class="btn-icon"
        aria-label={cat.archived ? t('metrics.show') : t('metrics.hide')}
        title={cat.archived ? t('metrics.show') : t('metrics.hide')}
        onclick={() => apply((c) => updateCategory(c, cat.id, { archived: !c.categories.find((x) => x.id === cat.id)?.archived }))}
      >
        <Icon name={cat.archived ? 'eyeOff' : 'eye'} />
      </button>
      <button type="button" class="btn-icon" aria-label={t('metrics.editCategory', { name: categoryName(cat) })} title={t('action.edit')} onclick={() => (editing = { kind: 'category', id: cat.id })}>
        <Icon name="pencil" />
      </button>
    </div>

    {#if !cat.archived}
      <div class="metric-list">
        {#each metrics as m (m.id)}
          {@const shift = shiftOf(m.id)}
          <div
            class="metric-row"
            class:archived={m.archived}
            class:lifted={drag?.id === m.id}
            class:settling={drag !== null && drag.id !== m.id}
            data-metric={m.id}
            style:transform={shift ? `translateY(${shift}px)` : undefined}
          >
            {#if metrics.length > 1}
              <div class="grip" aria-hidden="true" onpointerdown={gripDown} onpointermove={gripMove} onpointerup={gripUp} onpointercancel={gripUp}>
                <Icon name="grip" size={20} />
              </div>
            {/if}
            <button type="button" class="settings-row" onclick={() => (editing = { kind: 'metric', id: m.id })}>
              <span class="settings-row-text">
                <span class="settings-row-title">{metricName(m)}</span>
                {#if m.archived}<span class="settings-row-hint">{t('metrics.hidden')}</span>{/if}
              </span>
              <span class="settings-row-value">×{m.weight}</span>
              <Icon name="chevronRight" class="settings-row-chevron" />
            </button>
          </div>
        {/each}
      </div>
      <button type="button" class="add-row" onclick={() => addTo(cat)}><Icon name="plus" />{t('metrics.addMetric')}</button>
    {/if}
  </section>
{/each}

<div class="editor-footer">
  <button type="button" class="btn btn-secondary" onclick={addCat}><Icon name="plus" />{t('metrics.addCategory')}</button>
  <button type="button" class="btn btn-danger" onclick={restore}>{t('metrics.restore')}</button>
</div>

{#if editingMetric}
  {@const m = editingMetric}
  {@const ends = builtinEnds(m)}
  {@const siblings = metricsOf(config.categories.find((c) => c.id === m.cat) ?? config.categories[0]!)}
  {@const at = siblings.findIndex((x) => x.id === m.id)}
  <Sheet title={metricName(m)} onclose={close}>
    <div class="detail" data-editing={m.id}>
      <label class="field-group">
        <span class="t-field-label">{t('metrics.name')}</span>
        <input class="input" value={m.label ?? ''} placeholder={builtinName(m)} onchange={(e) => { const v = e.currentTarget.value; apply((c) => updateMetric(c, m.id, { label: v })); }} />
      </label>
      <div class="pair">
        <label class="field-group">
          <span class="t-field-label">{t('metrics.low')}</span>
          <input class="input" value={m.lo ?? ''} placeholder={ends[0]} onchange={(e) => { const v = e.currentTarget.value; apply((c) => updateMetric(c, m.id, { lo: v })); }} />
        </label>
        <label class="field-group">
          <span class="t-field-label">{t('metrics.high')}</span>
          <input class="input" value={m.hi ?? ''} placeholder={ends[1]} onchange={(e) => { const v = e.currentTarget.value; apply((c) => updateMetric(c, m.id, { hi: v })); }} />
        </label>
      </div>
      <div class="pair weight-cat">
        <label class="field-group">
          <span class="t-field-label">{t('metrics.weight')}</span>
          <Select
            class="weight"
            value={m.weight}
            options={WEIGHTS.map((w) => ({ value: w, label: `×${w}` }))}
            onchange={(weight) => apply((c) => updateMetric(c, m.id, { weight }))}
          />
        </label>
        <label class="field-group">
          <span class="t-field-label">{t('metrics.category')}</span>
          <Select
            value={m.cat}
            options={config.categories.map((c) => ({ value: c.id, label: categoryName(c) }))}
            onchange={(cat) => apply((c) => updateMetric(c, m.id, { cat }))}
          />
        </label>
      </div>
      <div class="icon-actions">
        <button type="button" disabled={at <= 0} onclick={() => apply((c) => moveMetric(c, m.id, -1))}><Icon name="arrowUp" size={20} /><span class="icon-action-word">{t('metrics.moveUp')}</span></button>
        <button type="button" disabled={at < 0 || at >= siblings.length - 1} onclick={() => apply((c) => moveMetric(c, m.id, 1))}><Icon name="arrowDown" size={20} /><span class="icon-action-word">{t('metrics.moveDown')}</span></button>
        <button type="button" aria-pressed={!!m.archived} onclick={() => apply((c) => updateMetric(c, m.id, { archived: !c.metrics.find((x) => x.id === m.id)?.archived }))}>
          <Icon name={m.archived ? 'eyeOff' : 'eye'} size={20} /><span class="icon-action-word">{m.archived ? t('metrics.show') : t('metrics.hide')}</span>
        </button>
        {#if canRemoveMetric(m, (id) => rated.has(id))}
          <button type="button" class="is-danger" onclick={() => remove(m)}><Icon name="trash" size={20} /><span class="icon-action-word">{t('metrics.remove')}</span></button>
        {/if}
      </div>
    </div>
  </Sheet>
{/if}

{#if editingCategory}
  {@const cat = editingCategory}
  {@const ci = config.categories.findIndex((c) => c.id === cat.id)}
  <Sheet title={categoryName(cat)} onclose={close}>
    <div class="detail" data-editing={cat.id}>
      <label class="field-group">
        <span class="t-field-label">{t('metrics.categoryName')}</span>
        <input
          class="input"
          value={cat.title ?? ''}
          placeholder={cat.builtin ? categoryName({ ...cat, title: undefined }) : ''}
          onchange={(e) => { const v = e.currentTarget.value; apply((c) => updateCategory(c, cat.id, { title: v })); }}
        />
      </label>
      <div class="field-group">
        <span class="t-field-label" id="icon-label">{t('metrics.icon')}</span>
        <div class="icon-picker" role="radiogroup" aria-labelledby="icon-label">
          {#each CATEGORY_ICONS as name (name)}
            <button
              type="button"
              class="btn-icon"
              role="radio"
              aria-checked={categoryIcon(cat) === name}
              aria-label={t(`icon.${name}`)}
              title={t(`icon.${name}`)}
              onclick={() => apply((c) => updateCategory(c, cat.id, { icon: name }))}
            >
              <Icon name={name} size={20} />
            </button>
          {/each}
        </div>
      </div>
      <div class="icon-actions">
        <button type="button" disabled={ci <= 0} onclick={() => apply((c) => moveCategory(c, cat.id, -1))}><Icon name="arrowUp" size={20} /><span class="icon-action-word">{t('metrics.moveUp')}</span></button>
        <button type="button" disabled={ci >= config.categories.length - 1} onclick={() => apply((c) => moveCategory(c, cat.id, 1))}><Icon name="arrowDown" size={20} /><span class="icon-action-word">{t('metrics.moveDown')}</span></button>
        <button type="button" aria-pressed={!!cat.archived} onclick={() => apply((c) => updateCategory(c, cat.id, { archived: !c.categories.find((x) => x.id === cat.id)?.archived }))}>
          <Icon name={cat.archived ? 'eyeOff' : 'eye'} size={20} /><span class="icon-action-word">{cat.archived ? t('metrics.show') : t('metrics.hide')}</span>
        </button>
      </div>
    </div>
  </Sheet>
{/if}

<style>
  .intro {
    margin: 0 0 var(--space-4);
  }
  .cat {
    padding: var(--space-3) 0 var(--space-2);
    border-top: 1px solid var(--border-soft);
  }
  .cat.archived .cat-head > :not(.btn-icon) {
    opacity: 0.55;
  }
  .cat-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
  }
  .cat-icon {
    display: inline-flex;
    color: var(--accent-amber);
  }
  .cat-name {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--font-serif);
    font-style: italic;
    font-weight: 400;
    font-size: 1.125rem;
    color: var(--text-heading);
    overflow-wrap: anywhere;
  }
  .tag {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .metric-list {
    display: flex;
    flex-direction: column;
  }
  .metric-row {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border-faint);
    background: var(--sheet-bg);
  }
  .metric-row.settling {
    transition: transform var(--dur-settle) var(--ease-settle);
  }
  .metric-row.lifted {
    position: relative;
    z-index: 1;
    border-radius: var(--corner-md);
    box-shadow: 0 8px 24px rgba(var(--shadow-rgb), calc(0.5 * var(--shadow-strength)));
  }
  .metric-row.archived .settings-row-title {
    color: var(--text-dim);
  }
  .grip {
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: stretch;
    width: 44px;
    margin-left: -12px;
    flex-shrink: 0;
    color: var(--text-faint);
    touch-action: none;
    cursor: grab;
  }
  .metric-row.lifted .grip {
    color: var(--accent-amber);
    cursor: grabbing;
  }
  .add-row {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    margin-top: var(--space-1);
    padding: 0;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-amber);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .editor-footer {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: space-between;
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-soft);
  }
  .detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .pair {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: var(--space-3);
  }
  /* The weight is a short number; the category name gets the room. */
  .weight-cat {
    grid-template-columns: 6.5rem minmax(0, 1fr);
  }
  .pair :global(.weight) {
    font-family: var(--font-mono);
  }
  .icon-picker {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .icon-picker [aria-checked='true'] {
    background: var(--accent-bright);
    color: var(--on-accent);
    border-radius: var(--corner-md);
  }
  .icon-actions {
    padding-top: var(--space-2);
    border-top: 1px solid var(--border-soft);
  }
</style>
