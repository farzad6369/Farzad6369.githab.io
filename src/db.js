import Database from 'better-sqlite3';
const db = new Database('./game.db');
db.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, score INTEGER DEFAULT 0)`);
export { db };
