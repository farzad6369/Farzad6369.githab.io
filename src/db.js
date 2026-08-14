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
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    language TEXT DEFAULT 'fa',
    gender TEXT,
    lives INTEGER DEFAULT 10,
    max_lives INTEGER DEFAULT 10,
    coins INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    stage INTEGER DEFAULT 0,
    referral_code TEXT UNIQUE,
    referred_by TEXT,
    last_life_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    stage INTEGER,
    correct INTEGER,
    score INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    txid TEXT UNIQUE,
    product TEXT,
    amount_usdt REAL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    approved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS weekly_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    week TEXT,
    score INTEGER DEFAULT 0,
    UNIQUE(user_id, week)
  );
`);

export function refill(user) {
  const lastLifeTime = new Date(user.last_life_at || Date.now()).getTime();
  const now = Date.now();

  const hoursPassed = Math.floor((now - lastLifeTime) / 3600000);

  if (hoursPassed > 0 && user.lives < user.max_lives) {
    const newLives = Math.min(
      user.max_lives,
      user.lives + hoursPassed
    );

    db.prepare(`
      UPDATE users
      SET lives = ?, last_life_at = ?
      WHERE id = ?
    `).run(newLives, new Date().toISOString(), user.id);

    user.lives = newLives;
  }

  return user;
}

export function week() {
  const date = new Date();

  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());

  return date.toISOString().slice(0, 10);
}
