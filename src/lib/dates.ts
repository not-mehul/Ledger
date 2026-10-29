// Visits are recorded at month granularity as "YYYY-MM".
// Very early versions of the app stored ISO weeks ("YYYY-Www"), which are
// still accepted on import and converted to the month they start in.

const MONTH_RE = /^(\d{4})-(\d{2})(?:-\d{2})?$/;
const WEEK_RE = /^(\d{4})-W(\d{1,2})$/;

export function toMonthString(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function currentMonthString(now = new Date()): string {
  return toMonthString(now.getFullYear(), now.getMonth());
}

/** Returns the Monday of the given ISO week as a local Date. */
function isoWeekStart(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const start = new Date(jan4);
  start.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (week - 1) * 7);
  return start;
}

/** Normalises any supported date string to "YYYY-MM", or returns null. */
export function normalizeMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  const week = WEEK_RE.exec(value);
  if (week) {
    const start = isoWeekStart(Number(week[1]), Number(week[2]));
    return toMonthString(start.getFullYear(), start.getMonth());
  }
  const month = MONTH_RE.exec(value);
  if (month) {
    const m = Number(month[2]);
    if (m >= 1 && m <= 12) return `${month[1]}-${month[2]}`;
  }
  return null;
}

export function parseMonth(value: string): { year: number; monthIndex: number } | null {
  const normalized = normalizeMonth(value);
  if (!normalized) return null;
  const [y, m] = normalized.split('-').map(Number);
  return { year: y!, monthIndex: m! - 1 };
}

/** "2024-05" → "May 2024". */
export function formatMonth(value: string, locale = 'en-US'): string {
  const parsed = parseMonth(value);
  if (!parsed) return value;
  return new Date(parsed.year, parsed.monthIndex, 1).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
  });
}
