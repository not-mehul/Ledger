<script lang="ts">
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
  import { categoryName, metricEnds, metricName, t } from '../i18n/index.svelte';
  import { ledger } from '../state/ledger.svelte';
  import { ui } from '../state/ui.svelte';

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
</script>

<p class="t-hint">{t('metrics.hint')}</p>

<details class="metrics-details" id="metricsEditor">
<summary class="btn btn-secondary">{t('metrics.edit')}</summary>

{#each config.categories as cat, ci (cat.id)}
  <fieldset class="cat-edit" class:archived={cat.archived}>
    <legend class="visually-hidden">{categoryName(cat)}</legend>
    <div class="cat-head">
      <input
        class="input cat-title"
        aria-label={t('metrics.categoryName')}
        value={cat.title ?? ''}
        placeholder={cat.builtin ? categoryName({ ...cat, title: undefined }) : ''}
        onchange={(e) => { const v = e.currentTarget.value; apply((c) => updateCategory(c, cat.id, { title: v })); }}
      />
      <div class="icon-actions">
        <button type="button" class="btn-icon" aria-label={t('metrics.moveUp')} disabled={ci === 0} onclick={() => apply((c) => moveCategory(c, cat.id, -1))}>↑</button>
        <button type="button" class="btn-icon" aria-label={t('metrics.moveDown')} disabled={ci === config.categories.length - 1} onclick={() => apply((c) => moveCategory(c, cat.id, 1))}>↓</button>
        <button type="button" class="btn btn-secondary small" onclick={() => apply((c) => updateCategory(c, cat.id, { archived: !c.categories.find((x) => x.id === cat.id)?.archived }))}>
          {cat.archived ? t('metrics.show') : t('metrics.hide')}
        </button>
      </div>
    </div>

    {#if !cat.archived}
      {#each metricsOf(cat) as m, mi (m.id)}
        {@const ends = builtinEnds(m)}
        <div class="metric-edit" class:archived={m.archived} data-metric={m.id}>
          <div class="metric-main">
            <input
              class="input"
              aria-label={t('metrics.name')}
              value={m.label ?? ''}
              placeholder={builtinName(m)}
              onchange={(e) => { const v = e.currentTarget.value; apply((c) => updateMetric(c, m.id, { label: v })); }}
            />
            <select
              class="select weight"
              aria-label={t('metrics.weight')}
              value={m.weight}
              onchange={(e) => { const v = e.currentTarget.value; apply((c) => updateMetric(c, m.id, { weight: Number(v) })); }}
            >
              {#each WEIGHTS as w (w)}
                <option value={w}>×{w}</option>
              {/each}
            </select>
          </div>
          <details>
            <summary>{t('metrics.low')} / {t('metrics.high')} · {t('metrics.category')}</summary>
            <div class="metric-more">
              <label class="field-group">
                <span class="t-field-label">{t('metrics.low')}</span>
                <input class="input" value={m.lo ?? ''} placeholder={ends[0]} onchange={(e) => { const v = e.currentTarget.value; apply((c) => updateMetric(c, m.id, { lo: v })); }} />
              </label>
              <label class="field-group">
                <span class="t-field-label">{t('metrics.high')}</span>
                <input class="input" value={m.hi ?? ''} placeholder={ends[1]} onchange={(e) => { const v = e.currentTarget.value; apply((c) => updateMetric(c, m.id, { hi: v })); }} />
              </label>
              <label class="field-group">
                <span class="t-field-label">{t('metrics.category')}</span>
                <select class="select" value={m.cat} onchange={(e) => { const v = e.currentTarget.value; apply((c) => updateMetric(c, m.id, { cat: v })); }}>
                  {#each config.categories as c (c.id)}
                    <option value={c.id}>{categoryName(c)}</option>
                  {/each}
                </select>
              </label>
            </div>
          </details>
          <div class="icon-actions">
            {#if m.archived}<span class="tag">{t('metrics.hidden')}</span>{/if}
            <button type="button" class="btn-icon" aria-label={t('metrics.moveUp')} disabled={mi === 0} onclick={() => apply((c) => moveMetric(c, m.id, -1))}>↑</button>
            <button type="button" class="btn-icon" aria-label={t('metrics.moveDown')} disabled={mi === metricsOf(cat).length - 1} onclick={() => apply((c) => moveMetric(c, m.id, 1))}>↓</button>
            <button type="button" class="btn btn-secondary small" onclick={() => apply((c) => updateMetric(c, m.id, { archived: !c.metrics.find((x) => x.id === m.id)?.archived }))}>
              {m.archived ? t('metrics.show') : t('metrics.hide')}
            </button>
            {#if canRemoveMetric(m, (id) => rated.has(id))}
              <button type="button" class="btn btn-danger small" onclick={() => apply((c) => removeMetric(c, m.id))}>{t('metrics.remove')}</button>
            {/if}
          </div>
        </div>
      {/each}
      <button type="button" class="btn btn-secondary add" onclick={() => apply((c) => addMetric(c, cat.id, t('metrics.newMetric')))}>+ {t('metrics.addMetric')}</button>
    {/if}
  </fieldset>
{/each}

<div class="editor-footer">
  <button type="button" class="btn btn-secondary" onclick={() => apply((c) => addCategory(c, t('metrics.newCategory')))}>+ {t('metrics.addCategory')}</button>
  <button type="button" class="btn btn-danger" onclick={restore}>{t('metrics.restore')}</button>
</div>
</details>

<style>
  .metrics-details > summary {
    display: inline-flex;
    list-style: none;
    margin-bottom: 0.75rem;
  }
  .metrics-details > summary::-webkit-details-marker {
    display: none;
  }
  .metrics-details[open] > summary {
    border-color: var(--accent-amber);
  }
  .cat-edit {
    border: none;
    border-top: 1px solid var(--border-soft);
    padding: 1rem 0 0.5rem;
  }
  .cat-edit.archived {
    opacity: 0.6;
  }
  .cat-head {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  .cat-title {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 1.125rem;
    color: var(--text-heading);
  }
  .metric-edit {
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius);
    background: var(--panel-bg-faint);
  }
  .metric-edit.archived {
    opacity: 0.55;
  }
  .metric-main {
    display: flex;
    gap: 0.5rem;
  }
  .weight {
    width: 5.5rem;
    flex-shrink: 0;
    font-family: var(--font-mono);
  }
  details {
    margin: 0.5rem 0;
  }
  details:not(.metrics-details) > summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-dim);
    cursor: pointer;
  }
  .metric-more {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .metric-more label:last-child {
    grid-column: 1 / -1;
  }
  .icon-actions {
    display: flex;
    gap: 0.375rem;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .btn-icon:disabled {
    color: var(--text-faint);
    cursor: default;
  }
  .small {
    padding: 0 0.875rem;
  }
  .tag {
    margin-right: auto;
    font-size: 0.625rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }
  .add {
    margin: 0.25rem 0 0.75rem;
  }
  .editor-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: space-between;
    padding-top: 1rem;
    border-top: 1px solid var(--border-soft);
  }
</style>
