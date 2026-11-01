<script lang="ts">
  import { MIN_SAMPLES, applySuggestedWeights, defaultTarget, valueSignals } from '../../domain/insights';
  import { activeMetrics, type MetricConfig } from '../../domain/metrics';
  import { metricName, t } from '../../i18n/index.svelte';
  import { ledger } from '../../state/ledger.svelte';
  import { ui } from '../../state/ui.svelte';

  /** Uses every entry, whatever period is selected: more data, clearer signal. */
  let targetId = $state(defaultTarget(ledger.config)?.id ?? '');

  // Follow config changes: pick a new target if the current one is hidden or removed.
  $effect(() => {
    if (!activeMetrics(ledger.config).some((m) => m.id === targetId)) targetId = defaultTarget(ledger.config)?.id ?? '';
  });

  const target = $derived(activeMetrics(ledger.config).find((m) => m.id === targetId));
  const targetName = $derived(target ? metricName(target) : '');
  const rated = $derived(ledger.entries.filter((e) => typeof e.ratings[targetId] === 'number').length);
  const signals = $derived(target ? valueSignals(ledger.entries, ledger.config, targetId) : []);
  const ready = $derived(signals.some((s) => s.r !== null));
  const changes = $derived(signals.filter((s) => s.suggested !== null && s.suggested !== s.metric.weight).length);

  const strongest = $derived(signals.find((s) => s.r !== null && s.r > 0));
  /** A heavily weighted metric that doesn't track the target: the most contradictory one. */
  const mismatch = $derived(
    signals
      .filter((s) => s.r !== null && s.r < 0.2 && s.metric.weight >= 2)
      .sort((a, b) => a.r! - b.r! || b.metric.weight - a.metric.weight)[0],
  );

  async function apply() {
    if (!changes) {
      ui.notify(t('value.noChange'));
      return;
    }
    const ok = await ui.confirm({
      title: t('value.applyTitle'),
      message: t('value.applyMessage', { count: changes }),
      action: t('value.apply'),
    });
    if (!ok) return;
    try {
      // Recompute against the latest config at commit time.
      await ledger.updateConfig((c: MetricConfig) => applySuggestedWeights(c, valueSignals(ledger.entries, c, targetId)));
      ui.notify(t('value.applied'), 'success');
    } catch (err) {
      console.error('Applying weights failed:', err);
      ui.notify(t('toast.saveFailed'), 'error');
    }
  }
</script>

<section class="panel" id="valueSignals" aria-labelledby="valueHeading">
  <div class="section-head">
    <h2 id="valueHeading">{t('value.title')}</h2>
  </div>

  <label class="target">
    <span class="t-field-label">{t('value.target')}</span>
    <select class="select" id="valueTarget" bind:value={targetId}>
      {#each activeMetrics(ledger.config) as m (m.id)}
        <option value={m.id}>{metricName(m)}</option>
      {/each}
    </select>
  </label>

  {#if !ready}
    <p class="t-hint" id="valueNeed">{t('value.need', { min: MIN_SAMPLES, count: rated })}</p>
  {:else}
    <p class="t-hint">{t('value.hint', { target: targetName, count: rated })}</p>

    <ul class="findings">
      {#if strongest}
        <li id="valueStrongest">{t('value.strongest', { metric: metricName(strongest.metric), target: targetName })}</li>
      {/if}
      {#if mismatch}
        <li id="valueMismatch">
          {t(mismatch.r! <= -0.2 ? 'value.opposite' : 'value.mismatch', {
            metric: metricName(mismatch.metric),
            weight: mismatch.metric.weight,
            target: targetName,
          })}
        </li>
      {/if}
    </ul>

    <table class="signals">
      <thead>
        <tr>
          <th scope="col"></th>
          <th scope="col">{t('value.link')}</th>
          <th scope="col">{t('value.weight')}</th>
        </tr>
      </thead>
      <tbody>
        {#each signals as s (s.metric.id)}
          <tr data-metric={s.metric.id}>
            <th scope="row">{metricName(s.metric)}</th>
            <td>
              <div class="link">
                {#if s.r === null}
                  <span class="none">{t('value.noSignal')}</span>
                {:else}
                  <span class="diverging" aria-hidden="true">
                    <span
                      class:neg={s.r < 0}
                      style:left={s.r < 0 ? `${50 + s.r * 50}%` : '50%'}
                      style:width="{Math.abs(s.r) * 50}%"
                    ></span>
                  </span>
                  <span class="r">{s.r.toFixed(2)}</span>
                {/if}
              </div>
            </td>
            <td class="w">
              ×{s.metric.weight}{#if s.suggested !== null && s.suggested !== s.metric.weight}<span class="changed"> → ×{s.suggested}</span>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    <p class="caveat">{t('value.caveat')}</p>
    <button type="button" class="btn btn-secondary" id="applyWeights" onclick={apply}>{t('value.apply')}</button>
  {/if}
</section>

<style>
  .target {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }
  .findings {
    list-style: none;
    margin-bottom: 1rem;
    display: grid;
    gap: 0.5rem;
  }
  .findings li {
    font-family: var(--font-serif);
    font-style: italic;
    color: var(--text-heading);
    font-size: 1rem;
    line-height: 1.45;
    padding-left: 0.75rem;
    border-left: 2px solid rgba(var(--accent-amber-rgb), 0.5);
  }
  .signals {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0.75rem;
    table-layout: fixed;
  }
  .signals th,
  .signals td {
    padding: 0.5rem 0.25rem;
    border-bottom: 1px solid var(--border-soft);
    font-size: 0.75rem;
    vertical-align: middle;
  }
  thead th {
    font-size: 0.5rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
    font-weight: 400;
    text-align: left;
  }
  thead th:first-child {
    width: 36%;
  }
  thead th:nth-child(3) {
    width: 26%;
    text-align: right;
  }
  tbody th {
    font-weight: 400;
    color: var(--text-muted);
    text-align: left;
    /* Long compound names (e.g. German) wrap instead of running into the bars. */
    hyphens: auto;
    overflow-wrap: anywhere;
  }
  .link {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .diverging {
    position: relative;
    flex: 1;
    height: 4px;
    background: var(--chart-track);
    border-radius: 2px;
  }
  .diverging::after {
    content: '';
    position: absolute;
    left: 50%;
    top: -3px;
    bottom: -3px;
    width: 1px;
    background: var(--border);
  }
  .diverging span {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--accent-sage);
    border-radius: 2px;
  }
  .diverging span.neg {
    background: var(--danger);
  }
  .r {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    color: var(--text-dim);
    min-width: 2.6rem;
    text-align: right;
  }
  .none {
    font-size: 0.625rem;
    color: var(--text-faint);
    font-style: italic;
  }
  .w {
    font-family: var(--font-mono);
    text-align: right;
    color: var(--text-dim);
  }
  .w .changed {
    color: var(--accent-amber);
  }
  .caveat {
    font-size: 0.6875rem;
    color: var(--text-faint);
    margin-bottom: 1rem;
  }
</style>
