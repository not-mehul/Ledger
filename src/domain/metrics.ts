// ============================================================
// Metric configuration. Users can rename, re-weight, archive and add
// metrics and categories; the defaults below seed a new ledger.
// Built-in items leave `label`/`title` unset so they're shown in the
// current language until the user renames them.
// ============================================================

export interface Category {
  id: string;
  /** User-provided title; built-ins fall back to a translation. */
  title?: string;
  icon?: string;
  builtin?: boolean;
  archived?: boolean;
}

export interface Metric {
  id: string;
  cat: string;
  weight: number;
  /** User-provided texts; built-ins fall back to translations. */
  label?: string;
  lo?: string;
  hi?: string;
  builtin?: boolean;
  archived?: boolean;
}

export interface MetricConfig {
  categories: Category[];
  metrics: Metric[];
}

export const RATING_MIN = 1;
export const RATING_MAX = 10;
export const RATING_DEFAULT = 5;

export const WEIGHT_MIN = 0.5;
export const WEIGHT_MAX = 5;
export const WEIGHT_STEP = 0.5;
/** Metrics at or above this weight get an accent colour. */
export const HEAVY_WEIGHT = 2;

export const BUILTIN_CATEGORY_IDS = ['env', 'city', 'food', 'people', 'practical', 'overall'] as const;
export const BUILTIN_METRIC_IDS = [
  'greenery', 'airQuality', 'temperature', 'visualBeauty', 'cleanliness', 'walkability',
  'foodQuality', 'foodAffordability', 'safety', 'friendliness', 'internet', 'returnDesire',
] as const;

export function defaultConfig(): MetricConfig {
  const cat = (id: string, icon: string): Category => ({ id, icon, builtin: true });
  const metric = (id: string, catId: string, weight: number): Metric => ({ id, cat: catId, weight, builtin: true });
  return {
    categories: [
      cat('env', '🌿'),
      cat('city', '🏙️'),
      cat('food', '🍽️'),
      cat('people', '👥'),
      cat('practical', '⚡'),
      cat('overall', '🧭'),
    ],
    metrics: [
      metric('greenery', 'env', 2),
      metric('airQuality', 'env', 1.5),
      metric('temperature', 'env', 1),
      metric('visualBeauty', 'city', 1),
      metric('cleanliness', 'city', 1),
      metric('walkability', 'city', 1),
      metric('foodQuality', 'food', 2),
      metric('foodAffordability', 'food', 1),
      metric('safety', 'people', 2),
      metric('friendliness', 'people', 1),
      metric('internet', 'practical', 2),
      metric('returnDesire', 'overall', 2),
    ],
  };
}

export function activeCategories(config: MetricConfig): Category[] {
  return config.categories.filter((c) => !c.archived);
}

/** Metrics that appear on the form and count towards the score. */
export function activeMetrics(config: MetricConfig): Metric[] {
  const live = new Set(activeCategories(config).map((c) => c.id));
  return config.metrics.filter((m) => !m.archived && live.has(m.cat));
}

export function metricsIn(config: MetricConfig, catId: string): Metric[] {
  return activeMetrics(config).filter((m) => m.cat === catId);
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function clampWeight(value: number): number {
  const stepped = Math.round(value / WEIGHT_STEP) * WEIGHT_STEP;
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Number.isFinite(stepped) ? stepped : 1));
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Validates an untrusted config (from disk or an import); falls back to defaults. */
export function normalizeConfig(raw: unknown): MetricConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawCats = Array.isArray(r.categories) ? r.categories : [];
  const rawMetrics = Array.isArray(r.metrics) ? r.metrics : [];

  const categories: Category[] = [];
  for (const c of rawCats as Record<string, unknown>[]) {
    const id = str(c?.id);
    if (!id || categories.some((x) => x.id === id)) continue;
    categories.push({
      id,
      title: str(c.title),
      icon: str(c.icon),
      builtin: c.builtin === true || undefined,
      archived: c.archived === true || undefined,
    });
  }
  const catIds = new Set(categories.map((c) => c.id));

  const metrics: Metric[] = [];
  for (const m of rawMetrics as Record<string, unknown>[]) {
    const id = str(m?.id);
    const cat = str(m?.cat);
    if (!id || !cat || !catIds.has(cat) || metrics.some((x) => x.id === id)) continue;
    metrics.push({
      id,
      cat,
      weight: clampWeight(Number(m.weight)),
      label: str(m.label),
      lo: str(m.lo),
      hi: str(m.hi),
      builtin: m.builtin === true || undefined,
      archived: m.archived === true || undefined,
    });
  }

  if (!metrics.some((m) => !m.archived)) return defaultConfig();
  return { categories, metrics };
}

/**
 * Adds metrics and categories from an imported config that this ledger
 * doesn't know yet, so imported ratings keep counting. Existing items are
 * left as the user configured them.
 */
export function mergeConfig(local: MetricConfig, incoming: MetricConfig): { config: MetricConfig; added: number } {
  const categories = [...local.categories];
  const metrics = [...local.metrics];
  let added = 0;
  for (const c of incoming.categories) {
    if (!categories.some((x) => x.id === c.id)) categories.push(c);
  }
  for (const m of incoming.metrics) {
    if (!metrics.some((x) => x.id === m.id)) {
      metrics.push(m);
      added++;
    }
  }
  return { config: { categories, metrics }, added };
}

// ---------- editing (pure; each returns a new config) ----------

export type MetricPatch = Partial<Pick<Metric, 'label' | 'lo' | 'hi' | 'weight' | 'cat' | 'archived'>>;
export type CategoryPatch = Partial<Pick<Category, 'title' | 'archived'>>;

/** Text fields: blank means "use the default", so built-ins fall back to translations. */
function cleanText(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export function updateMetric(config: MetricConfig, id: string, patch: MetricPatch): MetricConfig {
  return {
    ...config,
    metrics: config.metrics.map((m) => {
      if (m.id !== id) return m;
      const next = { ...m, ...patch };
      if ('label' in patch) next.label = cleanText(patch.label) ?? (m.builtin ? undefined : m.label);
      if ('lo' in patch) next.lo = cleanText(patch.lo);
      if ('hi' in patch) next.hi = cleanText(patch.hi);
      if ('weight' in patch) next.weight = clampWeight(Number(patch.weight));
      if (!next.archived) delete next.archived;
      return next;
    }),
  };
}

export function updateCategory(config: MetricConfig, id: string, patch: CategoryPatch): MetricConfig {
  return {
    ...config,
    categories: config.categories.map((c) => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch };
      if ('title' in patch) next.title = cleanText(patch.title) ?? (c.builtin ? undefined : c.title);
      if (!next.archived) delete next.archived;
      return next;
    }),
  };
}

/** Swaps a metric with its neighbour within the same category. */
export function moveMetric(config: MetricConfig, id: string, direction: -1 | 1): MetricConfig {
  const metrics = [...config.metrics];
  const i = metrics.findIndex((m) => m.id === id);
  if (i < 0) return config;
  const cat = metrics[i]!.cat;
  let j = i + direction;
  while (j >= 0 && j < metrics.length && metrics[j]!.cat !== cat) j += direction;
  if (j < 0 || j >= metrics.length) return config;
  [metrics[i], metrics[j]] = [metrics[j]!, metrics[i]!];
  return { ...config, metrics };
}

export function moveCategory(config: MetricConfig, id: string, direction: -1 | 1): MetricConfig {
  const categories = [...config.categories];
  const i = categories.findIndex((c) => c.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= categories.length) return config;
  [categories[i], categories[j]] = [categories[j]!, categories[i]!];
  return { ...config, categories };
}

export function addMetric(config: MetricConfig, cat: string, label: string): MetricConfig {
  return { ...config, metrics: [...config.metrics, { id: newId('m'), cat, weight: 1, label }] };
}

export function addCategory(config: MetricConfig, title: string): MetricConfig {
  return { ...config, categories: [...config.categories, { id: newId('c'), title }] };
}

/** Only metrics the user created and never rated can be deleted outright; others are hidden. */
export function canRemoveMetric(metric: Metric, isRated: (id: string) => boolean): boolean {
  return !metric.builtin && !isRated(metric.id);
}

export function removeMetric(config: MetricConfig, id: string): MetricConfig {
  return { ...config, metrics: config.metrics.filter((m) => m.id !== id) };
}

/** False if applying `next` would leave nothing to rate. */
export function hasActiveMetric(next: MetricConfig): boolean {
  return activeMetrics(next).length > 0;
}

/**
 * Built-ins return to their defaults (names, weights, order, visible);
 * custom metrics and categories are hidden rather than deleted, so
 * their ratings survive.
 */
export function restoreDefaults(config: MetricConfig): MetricConfig {
  const defaults = defaultConfig();
  const builtinCats = new Set(defaults.categories.map((c) => c.id));
  const builtinMetrics = new Set(defaults.metrics.map((m) => m.id));
  return {
    categories: [
      ...defaults.categories,
      ...config.categories.filter((c) => !builtinCats.has(c.id)).map((c) => ({ ...c, archived: true })),
    ],
    metrics: [
      ...defaults.metrics,
      ...config.metrics.filter((m) => !builtinMetrics.has(m.id)).map((m) => ({ ...m, archived: true })),
    ],
  };
}
