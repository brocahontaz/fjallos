import { Database } from 'bun:sqlite'

const sqlite = new Database('./fjallos.db', { create: true })

console.log('Creating tables...')

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    role       TEXT NOT NULL CHECK(role IN ('owner','guest')),
    csrf_token TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fs_nodes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id  INTEGER REFERENCES fs_nodes(id),
    name       TEXT NOT NULL,
    type       TEXT NOT NULL CHECK(type IN ('file','dir')),
    content    TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS window_layouts (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    app       TEXT NOT NULL,
    x         INTEGER,
    y         INTEGER,
    width     INTEGER,
    height    INTEGER,
    z_index   INTEGER,
    minimised INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS terminal_history (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    command   TEXT NOT NULL,
    output    TEXT,
    exit_code INTEGER,
    ran_at    TEXT DEFAULT (datetime('now'))
  );
`)

const rootExists = sqlite
  .query('SELECT id FROM fs_nodes WHERE parent_id IS NULL AND name = ?')
  .get('~')
if (!rootExists) {
  sqlite.exec(`
    INSERT INTO fs_nodes (parent_id, name, type) VALUES (NULL, '~', 'dir');
    INSERT INTO fs_nodes (parent_id, name, type) VALUES (1, 'projects', 'dir');
    INSERT INTO fs_nodes (parent_id, name, type, content) VALUES (1, 'about.txt', 'file', 'A personal web desktop.');
    INSERT INTO fs_nodes (parent_id, name, type, content) VALUES (1, 'readme.txt', 'file', 'Welcome to fjallos - a personal web desktop.');
  `)
  console.log('Seeded initial filesystem')
}

console.log('Database ready.')
sqlite.close()
