import Database from "better-sqlite3";
import path from "path";

const db = new Database("scouting.db");

console.log("Database absolute path:", path.resolve("scouting.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS regionals (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    year INTEGER
  );

  CREATE TABLE IF NOT EXISTS match_data (
    id           INTEGER PRIMARY KEY,
    regional_id  INTEGER NOT NULL REFERENCES regionals(id),
    team_number  INTEGER,
    match_number INTEGER,
    scout_name   TEXT,
    payload      TEXT NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pit_data (
    id          INTEGER PRIMARY KEY,
    regional_id INTEGER NOT NULL REFERENCES regionals(id),
    form_id     TEXT,
    payload     TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Helper: get or create a regional by name, returns its id
export function getOrCreateRegional(name) {
  if (!name) return null;
  db.prepare(`INSERT OR IGNORE INTO regionals (name) VALUES (?)`).run(name);
  return db.prepare(`SELECT id FROM regionals WHERE name = ?`).get(name)?.id ?? null;
}

export default db;