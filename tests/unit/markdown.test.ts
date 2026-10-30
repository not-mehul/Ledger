import { describe, expect, it } from 'vitest';
import { addMetric } from '../../src/domain/metrics';
import { buildMarkdown, parseMarkdown } from '../../src/lib/markdown';
import { config, ctx, makeEntry } from './fixtures';

const NOW = new Date('2025-01-02T03:04:05Z');

describe('markdown export/import', () => {
  const entries = [
    makeEntry({ id: 'a', notes: 'Line one\nLine two --> tricky', lat: 30.27, lon: -97.74, country: 'US' }),
    makeEntry({ id: 'b', city: 'Kyoto', state: 'Japan', date: '2022-11' }),
  ];

  it('round-trips entries and the metric config losslessly', () => {
    const custom = addMetric(config, 'env', 'Beaches');
    const md = buildMarkdown(entries, { ...ctx, config: custom }, NOW);
    const parsed = parseMarkdown(md);
    expect(parsed.skipped).toBe(0);
    expect(parsed.entries).toEqual(expect.arrayContaining(entries));
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.config).toEqual(custom);
  });

  it('includes a readable, translated summary', () => {
    const md = buildMarkdown(entries, ctx, NOW);
    expect(md).toContain('# 🧭 Ledger');
    expect(md).toContain('**Total cities logged:** 2');
    expect(md).toContain('## Austin · Texas');
    expect(md).toContain('### 🌿 Environment & Nature');
    expect(md).toContain('| Greenery & Nature Access | `███████░░░` 7/10 | ×2 |');
    expect(md).toContain('🟡 **70** / 100');
    expect(md).toContain('> Line one\n> Line two');
  });

  it('imports files exported by Travel Logbook', () => {
    const legacy = [
      '# ✈️ Travel Logbook',
      '## Austin · Texas',
      '<!-- data:{"id":"lx2k9","city":"Austin","state":"Texas","date":"2024-05","score":70,"ratings":{"greenery":7},"notes":"","savedAt":"2024-05-20T12:00:00.000Z"} -->',
      '<!-- data:{not json} -->',
    ].join('\r\n');
    const parsed = parseMarkdown(legacy);
    expect(parsed.skipped).toBe(1);
    expect(parsed.config).toBeUndefined();
    expect(parsed.entries[0]).toMatchObject({ id: 'lx2k9', city: 'Austin', ratings: { greenery: 7 }, photos: [] });
  });
});
