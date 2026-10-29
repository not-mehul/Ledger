// ============================================================
// Data layer
// - On native Android: persists to SQLite via @capacitor-community/sqlite
// - In a desktop browser (npm run dev): falls back to localStorage
//   so you can develop the UI without rebuilding the APK each time.
// ============================================================

import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const DB_NAME     = 'logbook';
const DB_VERSION  = 1;
const STORAGE_KEY = 'tlb_entries';

const isNative = Capacitor.isNativePlatform();

let sqlite      = null;
let db          = null;
let initPromise = null;

/**
 * Initializes the database. Idempotent — safe to call multiple times.
 */
export function initDb() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!isNative) return; // browser dev — nothing to do, localStorage is implicit

    sqlite = new SQLiteConnection(CapacitorSQLite);

    // Reuse an existing connection if it's already open (e.g. after hot reload)
    const existing = await sqlite.isConnection(DB_NAME, false);
    if (existing.result) {
      db = await sqlite.retrieveConnection(DB_NAME, false);
    } else {
      db = await sqlite.createConnection(
        DB_NAME, false, 'no-encryption', DB_VERSION, false
      );
    }

    await db.open();

    await db.execute(`
      CREATE TABLE IF NOT EXISTS entries (
        id       TEXT PRIMARY KEY,
        city     TEXT NOT NULL,
        state    TEXT NOT NULL,
        date     TEXT,
        score    REAL,
        ratings  TEXT,
        notes    TEXT,
        savedAt  TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_entries_date  ON entries(date);
      CREATE INDEX IF NOT EXISTS idx_entries_score ON entries(score);
    `);
  })();
  return initPromise;
}

/** Returns all entries, with `ratings` already parsed back into an object. */
export async function getAllEntries() {
  await initDb();

  if (!isNative) {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try { return JSON.parse(stored); } catch { return []; }
  }

  const result = await db.query('SELECT * FROM entries;');
  const rows   = result.values || [];
  return rows.map(r => ({
    id:      r.id,
    city:    r.city,
    state:   r.state,
    date:    r.date,
    score:   r.score,
    notes:   r.notes || '',
    savedAt: r.savedAt,
    ratings: r.ratings ? safeParse(r.ratings, {}) : {}
  }));
}

/** Insert-or-replace by primary key. */
export async function upsertEntry(entry) {
  await initDb();

  if (!isNative) {
    const all = await getAllEntries();
    const idx = all.findIndex(e => e.id === entry.id);
    if (idx >= 0) all[idx] = entry; else all.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return;
  }

  await db.run(
    `INSERT OR REPLACE INTO entries
       (id, city, state, date, score, ratings, notes, savedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      entry.id,
      entry.city,
      entry.state,
      entry.date,
      entry.score,
      JSON.stringify(entry.ratings || {}),
      entry.notes || '',
      entry.savedAt
    ]
  );
}

/** Delete by primary key. */
export async function deleteEntryById(id) {
  await initDb();

  if (!isNative) {
    const all      = await getAllEntries();
    const filtered = all.filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return;
  }

  await db.run('DELETE FROM entries WHERE id = ?;', [id]);
}

/** Useful for the UI to know which environment it's running in. */
export function isNativeApp() {
  return isNative;
}

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}
