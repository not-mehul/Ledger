import { describe, expect, it } from 'vitest';
import {
  activeMetrics,
  addCategory,
  addMetric,
  canRemoveMetric,
  clampWeight,
  defaultConfig,
  hasActiveMetric,
  mergeConfig,
  metricsIn,
  moveCategory,
  moveMetric,
  normalizeConfig,
  restoreDefaults,
  updateCategory,
  updateMetric,
} from '../../src/domain/metrics';

const base = defaultConfig();

describe('normalizeConfig', () => {
  it('keeps a valid config and drops broken items', () => {
    const raw = {
      categories: [{ id: 'env', builtin: true }, { id: 'env' }, { title: 'no id' }],
      metrics: [
        { id: 'greenery', cat: 'env', weight: 2.2, builtin: true },
        { id: 'orphan', cat: 'nope', weight: 1 },
        { id: 'greenery', cat: 'env', weight: 1 },
      ],
    };
    const c = normalizeConfig(raw);
    expect(c.categories.map((x) => x.id)).toEqual(['env']);
    expect(c.metrics).toEqual([{ id: 'greenery', cat: 'env', weight: 2, builtin: true }]);
  });

  it('falls back to the defaults when nothing is usable', () => {
    expect(normalizeConfig(null)).toEqual(base);
    expect(normalizeConfig({ categories: [{ id: 'a' }], metrics: [{ id: 'm', cat: 'a', archived: true }] })).toEqual(base);
  });
});

describe('editing', () => {
  it('renames, and blank names fall back to the built-in label', () => {
    const renamed = updateMetric(base, 'greenery', { label: '  Parks ' });
    expect(renamed.metrics[0]!.label).toBe('Parks');
    expect(updateMetric(renamed, 'greenery', { label: '' }).metrics[0]!.label).toBeUndefined();
  });

  it('keeps a custom metric name when cleared', () => {
    const c = addMetric(base, 'env', 'Beaches');
    const id = c.metrics.at(-1)!.id;
    expect(updateMetric(c, id, { label: ' ' }).metrics.at(-1)!.label).toBe('Beaches');
  });

  it('clamps weights to the allowed steps', () => {
    expect(clampWeight(2.3)).toBe(2.5);
    expect(clampWeight(0)).toBe(0.5);
    expect(clampWeight(99)).toBe(5);
    expect(updateMetric(base, 'internet', { weight: 3.1 }).metrics.find((m) => m.id === 'internet')!.weight).toBe(3);
  });

  it('reorders metrics within their category only', () => {
    const moved = moveMetric(base, 'airQuality', -1);
    expect(metricsIn(moved, 'env').map((m) => m.id)).toEqual(['airQuality', 'greenery', 'temperature']);
    expect(moveMetric(base, 'greenery', -1)).toBe(base);
    expect(moveMetric(base, 'temperature', 1)).toBe(base); // next metric is in another category
  });

  it('reorders, hides and adds categories', () => {
    expect(moveCategory(base, 'city', -1).categories[0]!.id).toBe('city');
    const hidden = updateCategory(base, 'food', { archived: true });
    expect(activeMetrics(hidden).some((m) => m.cat === 'food')).toBe(false);
    const added = addCategory(base, 'Nightlife');
    expect(added.categories.at(-1)).toMatchObject({ title: 'Nightlife' });
  });

  it('only lets never-rated custom metrics be removed', () => {
    const c = addMetric(base, 'env', 'Beaches');
    const custom = c.metrics.at(-1)!;
    expect(canRemoveMetric(custom, () => false)).toBe(true);
    expect(canRemoveMetric(custom, () => true)).toBe(false);
    expect(canRemoveMetric(base.metrics[0]!, () => false)).toBe(false);
  });

  it('detects a config with nothing left to rate', () => {
    const allHidden = base.metrics.reduce((c, m) => updateMetric(c, m.id, { archived: true }), base);
    expect(hasActiveMetric(allHidden)).toBe(false);
  });

  it('restores defaults but keeps custom metrics (hidden)', () => {
    let c = updateMetric(base, 'safety', { weight: 5, label: 'Safe?' });
    c = addMetric(c, 'env', 'Beaches');
    const restored = restoreDefaults(c);
    expect(restored.metrics.find((m) => m.id === 'safety')).toEqual(base.metrics.find((m) => m.id === 'safety'));
    expect(restored.metrics.at(-1)).toMatchObject({ label: 'Beaches', archived: true });
  });
});

describe('mergeConfig', () => {
  it('adds unknown metrics and categories without touching existing ones', () => {
    const local = updateMetric(base, 'safety', { weight: 4 });
    let incoming = addCategory(base, 'Nightlife');
    incoming = addMetric(incoming, incoming.categories.at(-1)!.id, 'Bars');
    const { config, added } = mergeConfig(local, incoming);
    expect(added).toBe(1);
    expect(config.metrics.find((m) => m.id === 'safety')!.weight).toBe(4);
    expect(config.categories.at(-1)).toMatchObject({ title: 'Nightlife' });
  });
});
