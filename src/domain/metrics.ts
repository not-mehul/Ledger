// ============================================================
// Metric & category definitions — the single source of truth
// for the entry form, the ledger cards and the Markdown export.
// ============================================================

export type CategoryId = 'env' | 'city' | 'food' | 'people' | 'practical' | 'overall';

export interface Metric {
  id: string;
  label: string;
  weight: number;
  cat: CategoryId;
  /** Heavily weighted metrics get an accent colour in the UI. */
  high: boolean;
  lo: string;
  hi: string;
}

export interface Category {
  id: CategoryId;
  /** Heading on the entry form. */
  title: string;
  /** Label on ledger cards and in the export. */
  label: string;
}

export const METRICS: readonly Metric[] = [
  { id: 'greenery',          label: 'Greenery & Nature Access', weight: 2,   cat: 'env',       high: true,  lo: 'Barren',        hi: 'Lush'         },
  { id: 'airQuality',        label: 'Air Quality',              weight: 1.5, cat: 'env',       high: false, lo: 'Polluted',      hi: 'Pristine'     },
  { id: 'temperature',       label: 'Temperature Comfort',      weight: 1,   cat: 'env',       high: false, lo: 'Unbearable',    hi: 'Perfect'      },
  { id: 'visualBeauty',      label: 'Visual Beauty',            weight: 1,   cat: 'city',      high: false, lo: 'Dull',          hi: 'Stunning'     },
  { id: 'cleanliness',       label: 'Cleanliness',              weight: 1,   cat: 'city',      high: false, lo: 'Grimy',         hi: 'Immaculate'   },
  { id: 'walkability',       label: 'Walkability',              weight: 1,   cat: 'city',      high: false, lo: 'Car-only',      hi: 'Walk heaven'  },
  { id: 'foodQuality',       label: 'Food Quality',             weight: 2,   cat: 'food',      high: true,  lo: 'Disappointing', hi: 'Exceptional'  },
  { id: 'foodAffordability', label: 'Food Affordability',       weight: 1,   cat: 'food',      high: false, lo: 'Expensive',     hi: 'Very cheap'   },
  { id: 'safety',            label: 'Safety',                   weight: 2,   cat: 'people',    high: true,  lo: 'Unsafe',        hi: 'Very safe'    },
  { id: 'friendliness',      label: 'Friendliness',             weight: 1,   cat: 'people',    high: false, lo: 'Hostile',       hi: 'Welcoming'    },
  { id: 'internet',          label: 'Internet Speed',           weight: 2,   cat: 'practical', high: true,  lo: 'Unusable',      hi: 'Blazing fast' },
  { id: 'returnDesire',      label: 'Return Desire',            weight: 2,   cat: 'overall',   high: true,  lo: 'Never again',   hi: 'Must return'  },
];

export const CATEGORIES: readonly Category[] = [
  { id: 'env',       title: 'Environment',     label: '🌿 Environment & Nature' },
  { id: 'city',      title: 'Feel',            label: '🏙️ City Feel'            },
  { id: 'food',      title: 'Food Scene',      label: '🍽️ Food Scene'           },
  { id: 'people',    title: 'People & Safety', label: '👥 People & Safety'      },
  { id: 'practical', title: 'Workability',     label: '⚡ Practical'            },
  { id: 'overall',   title: 'Overall',         label: '🧭 Overall'              },
];

export const RATING_MIN = 1;
export const RATING_MAX = 10;
export const RATING_DEFAULT = 5;

export function metricsIn(cat: CategoryId): Metric[] {
  return METRICS.filter((m) => m.cat === cat);
}
