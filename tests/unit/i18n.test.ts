import { describe, expect, it } from 'vitest';
import de from '../../src/i18n/de';
import en from '../../src/i18n/en';
import es from '../../src/i18n/es';
import fr from '../../src/i18n/fr';
import { categoryName, metricEnds, metricName, translateWith, type Messages } from '../../src/i18n/index.svelte';
import { defaultConfig } from '../../src/domain/metrics';

const placeholders = (v: unknown) => new Set(JSON.stringify(v).match(/\{\w+\}/g));

describe('translations', () => {
  for (const [name, messages] of Object.entries({ es, fr, de })) {
    it(`${name} matches the English keys, plural shapes and placeholders`, () => {
      expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
      for (const [key, value] of Object.entries(en)) {
        const other = (messages as Record<string, unknown>)[key];
        expect(typeof other, key).toBe(typeof value);
        // Every placeholder the translation uses must exist in English.
        for (const p of placeholders(other)) expect(placeholders(value).has(p), `${key} ${p}`).toBe(true);
      }
    });
  }

  it('interpolates and pluralises per locale', () => {
    const tEn = translateWith(en as Messages, 'en');
    const tFr = translateWith(fr, 'fr');
    expect(tEn('status.entries', { count: 1 })).toBe('1 entry');
    expect(tEn('status.entries', { count: 3 })).toBe('3 entries');
    expect(tFr('status.entries', { count: 0 })).toBe('0 entrée');
    expect(tEn('toast.saved', { place: 'Austin, Texas', score: 70 })).toBe('Saved: Austin, Texas — 70/100');
  });

  it('labels built-ins from the catalogue and custom items from the user', () => {
    const tDe = translateWith(de, 'de');
    const config = defaultConfig();
    const safety = config.metrics.find((m) => m.id === 'safety')!;
    expect(metricName(safety, tDe)).toBe('Sicherheit');
    expect(metricName({ ...safety, label: 'Mine' }, tDe)).toBe('Mine');
    expect(metricEnds({ id: 'x', cat: 'env', weight: 1 }, tDe)).toEqual(['Schlecht', 'Hervorragend']);
    expect(categoryName(config.categories[0]!, tDe)).toBe('Umwelt und Natur');
  });
});
