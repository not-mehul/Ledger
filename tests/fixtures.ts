import type { Entry } from '../src/domain/entry';
import { METRICS } from '../src/domain/metrics';
import { calcScore } from '../src/domain/score';

export function makeEntry(overrides: Partial<Entry> = {}): Entry {
  const ratings = Object.fromEntries(METRICS.map((m) => [m.id, 7]));
  return {
    id: 'e1',
    city: 'Austin',
    state: 'Texas',
    date: '2024-05',
    ratings,
    score: calcScore(ratings),
    notes: '',
    savedAt: '2024-05-20T12:00:00.000Z',
    ...overrides,
  };
}
