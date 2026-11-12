// ============================================================
// Icons (Lucide, ISC licence; style.md §9), as plain element lists so
// they render without {@html}. Category icons are stored by name in the
// metric config; anything unknown (old emoji included) falls back.
// ============================================================

type El = ['path', { d: string }] | ['circle', { cx: number; cy: number; r: number }];

const p = (d: string): El => ['path', { d }];
const c = (cx: number, cy: number, r: number): El => ['circle', { cx, cy, r }];

export const ICONS = {
  // Categories
  leaf: [p('M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z'), p('M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12')],
  building: [p('M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z'), p('M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2'), p('M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2'), p('M10 6h4'), p('M10 10h4'), p('M10 14h4'), p('M10 18h4')],
  utensils: [p('M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2'), p('M7 2v20'), p('M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7')],
  users: [p('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'), c(9, 7, 4), p('M22 21v-2a4 4 0 0 0-3-3.87'), p('M16 3.13a4 4 0 0 1 0 7.75')],
  laptop: [p('M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16')],
  compass: [p('m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z'), c(12, 12, 10)],
  train: [p('M8 3.1V7a4 4 0 0 0 8 0V3.1'), p('m9 15-1-1'), p('m15 15 1-1'), p('M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z'), p('m8 19-2 3'), p('m16 19 2 3')],
  wallet: [p('M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1'), p('M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4')],
  landmark: [p('M3 22h18'), p('M6 18v-7'), p('M10 18v-7'), p('M14 18v-7'), p('M18 18v-7'), p('M12 2 20 7H4z')],
  moon: [p('M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z')],
  sun: [c(12, 12, 4), p('M12 2v2'), p('M12 20v2'), p('m4.93 4.93 1.41 1.41'), p('m17.66 17.66 1.41 1.41'), p('M2 12h2'), p('M20 12h2'), p('m6.34 17.66-1.41 1.41'), p('m19.07 4.93-1.41 1.41')],
  heart: [p('M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z')],
  bookmark: [p('m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z')],
  // Actions
  pencil: [p('M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'), p('m15 5 4 4')],
  share: [c(18, 5, 3), c(6, 12, 3), c(18, 19, 3), p('M8.59 13.51 15.42 17.49'), p('M15.41 6.51 8.59 10.49')],
  trash: [p('M3 6h18'), p('M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'), p('M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'), p('M10 11v6'), p('M14 11v6')],
  compare: [c(5, 6, 3), p('M12 6h5a2 2 0 0 1 2 2v7'), p('m15 9-3-3 3-3'), c(19, 18, 3), p('M12 18H7a2 2 0 0 1-2-2V9'), p('m9 15 3 3-3 3')],
  x: [p('M18 6 6 18'), p('m6 6 12 12')],
  download: [p('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), p('m7 10 5 5 5-5'), p('M12 15V3')],
  eye: [p('M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0'), c(12, 12, 3)],
  eyeOff: [p('M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49'), p('M14.084 14.158a3 3 0 0 1-4.242-4.242'), p('M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143'), p('m2 2 20 20')],
  imagePlus: [p('M16 5h6'), p('M19 2v6'), p('M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5'), p('m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'), c(9, 9, 2)],
  camera: [p('M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'), c(12, 13, 3)],
  arrowUp: [p('m5 12 7-7 7 7'), p('M12 19V5')],
  arrowDown: [p('M12 5v14'), p('m19 12-7 7-7-7')],
} satisfies Record<string, El[]>;

export type IconName = keyof typeof ICONS;

/** The icons a category can wear, in picker order (two rows of six on a phone). */
export const CATEGORY_ICONS = [
  'leaf', 'building', 'utensils', 'users', 'laptop', 'compass',
  'train', 'wallet', 'landmark', 'moon', 'sun', 'heart',
] as const satisfies readonly IconName[];
/** A category without a chosen icon shows a bookmark. */
export type CategoryIcon = (typeof CATEGORY_ICONS)[number] | 'bookmark';

const BUILTIN_ICONS: Record<string, CategoryIcon> = {
  env: 'leaf', city: 'building', food: 'utensils', people: 'users', practical: 'laptop', overall: 'compass',
};

export function isCategoryIcon(v: unknown): v is CategoryIcon {
  return typeof v === 'string' && (v === 'bookmark' || (CATEGORY_ICONS as readonly string[]).includes(v));
}

/** The icon a category shows: its own, else its built-in one, else a bookmark. */
export function categoryIcon(cat: { id: string; icon?: string }): CategoryIcon {
  if (isCategoryIcon(cat.icon)) return cat.icon;
  return BUILTIN_ICONS[cat.id] ?? 'bookmark';
}
