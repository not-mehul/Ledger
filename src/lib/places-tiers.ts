/**
 * The quick places file keeps towns ranked this or higher (8 × log10 of
 * population: 32 is 10,000 people). Shared by vite.config.ts, which writes the
 * file, and the tests, which check it. No imports, so the build can load it.
 */
export const QUICK_MIN_RANK = 32;
