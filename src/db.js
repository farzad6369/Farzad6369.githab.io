
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const databaseFile = process.env.DATABASE_FILE || './data/game.db';
fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

export const db = new Database(databaseFile);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT, lives INTEGER DEFAULT 10, score INTEGER DEFAULT 0, last_life_at TEXT);
  CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, stage INTEGER, correct INTEGER, score INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS weekly_scores (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, week TEXT, score INTEGER DEFAULT 0, UNIQUE(user_id, week));
`);

export function refill(user) {
  const lastLifeTime = new Date(user.last_life_at || Date.now()).getTime();
  const now = Date.now();
  const hoursPassed = Math.floor((now - lastLifeTime) / 3600000);
  if (hoursPassed > 0 && user.lives < 10) {
    const newLives = Math.min(10, user.lives + hoursPassed);
    db.prepare('UPDATE users SET lives = ?, last_life_at = ? WHERE id = ?').run(newLives, new Date().toISOString(), user.id);
    user.lives = newLives;
  }
  return user;
}
