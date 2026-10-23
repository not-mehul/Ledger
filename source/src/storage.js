import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";

const DB_NAME = "logbook";
const DB_VERSION = 1;
const LOCAL_STORAGE_KEY = "tlb_entries";
const isNative = Capacitor.isNativePlatform();

let sqlite = null;
let db = null;
let initPromise = null;

// Native: opens (or reuses) the SQLite connection and creates the schema.
// Web: no-op; entries live in localStorage instead.
export function initDatabase() {
  return (
    initPromise ||
    (initPromise = (async () => {
      if (!isNative) return;
      sqlite = new SQLiteConnection(CapacitorSQLite);
      const exists = (await sqlite.isConnection(DB_NAME, false)).result;
      db = exists
        ? await sqlite.retrieveConnection(DB_NAME, false)
        : await sqlite.createConnection(
            DB_NAME,
            false,
            "no-encryption",
            DB_VERSION,
            false,
          );
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
    })())
  );
}

export async function loadEntries() {
  await initDatabase();
  if (!isNative) {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const result = await db.query("SELECT * FROM entries;");
  return (result.values || []).map((row) => ({
    id: row.id,
    city: row.city,
    state: row.state,
    date: row.date,
    score: row.score,
    notes: row.notes || "",
    savedAt: row.savedAt,
    ratings: row.ratings ? safeJsonParse(row.ratings, {}) : {},
  }));
}

export async function saveEntry(entry) {
  await initDatabase();
  if (!isNative) {
    const all = await loadEntries();
    const idx = all.findIndex((e) => e.id === entry.id);
    if (idx >= 0) all[idx] = entry;
    else all.push(entry);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
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
      entry.notes || "",
      entry.savedAt,
    ],
  );
}

export async function deleteEntry(id) {
  await initDatabase();
  if (!isNative) {
    const remaining = (await loadEntries()).filter((e) => e.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remaining));
    return;
  }
  await db.run("DELETE FROM entries WHERE id = ?;", [id]);
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
