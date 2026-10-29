import { describe, expect, it } from 'vitest';
import { buildMarkdown, parseMarkdown } from '../src/lib/markdown';
import { makeEntry } from './fixtures';

describe('markdown export/import', () => {
  const entries = [
    makeEntry({ id: 'a', notes: 'Line one\nLine two --> tricky' }),
    makeEntry({ id: 'b', city: 'Kyoto', state: 'Japan', date: '2022-11' }),
  ];

  it('round-trips entries losslessly', () => {
    const md = buildMarkdown(entries, new Date('2025-01-02T03:04:05Z'));
    const { entries: parsed, skipped } = parseMarkdown(md);
    expect(skipped).toBe(0);
    expect(parsed).toEqual(expect.arrayContaining(entries));
    expect(parsed).toHaveLength(2);
  });

  it('includes a readable summary', () => {
    const md = buildMarkdown(entries, new Date('2025-01-02T03:04:05Z'));
    expect(md).toContain('# 🧭 Ledger');
    expect(md).toContain('**Total cities logged:** 2');
    expect(md).toContain('## Austin · Texas');
    expect(md).toContain('<!-- exportedAt:2025-01-02T03:04:05.000Z -->');
    expect(md).toContain('> Line one\n> Line two');
  });

  it('imports files exported by Travel Logbook', () => {
    const legacy = [
      '# ✈️ Travel Logbook',
      '## Austin · Texas',
      '<!-- data:{"id":"lx2k9","city":"Austin","state":"Texas","date":"2024-05","score":70,"ratings":{"greenery":7},"notes":"","savedAt":"2024-05-20T12:00:00.000Z"} -->',
      '<!-- data:{not json} -->',
    ].join('\r\n');
    const { entries: parsed, skipped } = parseMarkdown(legacy);
    expect(skipped).toBe(1);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: 'lx2k9', city: 'Austin', date: '2024-05' });
  });
});
