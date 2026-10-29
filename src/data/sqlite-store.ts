import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { normalizeEntry, type Entry } from '../domain/entry';
import type { EntryStore } from './store';

const DB_NAME = 'ledger';

/**
 * Schema history. Append a new `{ toVersion, statements }` step for every
 * schema change — never edit a step that has shipped. The plugin runs the
 * steps above the database's current version when the connection opens.
 */
const MIGRATIONS = [
  {
    toVersion: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS entries (
         id      TEXT PRIMARY KEY NOT NULL,
         city    TEXT NOT NULL,
         state   TEXT NOT NULL,
         date    TEXT NOT NULL,
         score   REAL NOT NULL,
         ratings TEXT NOT NULL,
         notes   TEXT NOT NULL DEFAULT '',
         savedAt TEXT NOT NULL
       );`,
      'CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);',
      'CREATE INDEX IF NOT EXISTS idx_entries_score ON entries(score);',
    ],
  },
];

const DB_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.toVersion;

const UPSERT_SQL = `INSERT OR REPLACE INTO entries
  (id, city, state, date, score, ratings, notes, savedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;

interface EntryRow {
  id: string;
  city: string;
  state: string;
  date: string;
  score: number;
  ratings: string;
  notes: string | null;
  savedAt: string;
}

function toParams(e: Entry): unknown[] {
  return [e.id, e.city, e.state, e.date, e.score, JSON.stringify(e.ratings), e.notes, e.savedAt];
}

function fromRow(row: EntryRow): Entry | null {
  let ratings: unknown = {};
  try {
    ratings = JSON.parse(row.ratings);
  } catch {
    // Fall through with default ratings rather than dropping the entry.
  }
  return normalizeEntry({ ...row, ratings });
}

class SqliteStore implements EntryStore {
  constructor(private readonly db: SQLiteDBConnection) {}

  async list(): Promise<Entry[]> {
    const result = await this.db.query('SELECT * FROM entries;');
    return ((result.values ?? []) as EntryRow[])
      .map(fromRow)
      .filter((e): e is Entry => e !== null);
  }

  async upsert(entry: Entry): Promise<void> {
    await this.db.run(UPSERT_SQL, toParams(entry));
  }

  async upsertMany(entries: readonly Entry[]): Promise<void> {
    if (!entries.length) return;
    await this.db.executeSet(
      entries.map((e) => ({ statement: UPSERT_SQL, values: toParams(e) })),
      true,
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.run('DELETE FROM entries WHERE id = ?;', [id]);
  }
}

export async function openSqliteStore(): Promise<EntryStore> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  await sqlite.addUpgradeStatement(DB_NAME, MIGRATIONS);

  // Reuse an open connection (e.g. after a live-reload) instead of failing.
  const { result: exists } = await sqlite.isConnection(DB_NAME, false);
  const db = exists
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);

  const { result: isOpen } = await db.isDBOpen();
  if (!isOpen) await db.open();

  return new SqliteStore(db);
}
