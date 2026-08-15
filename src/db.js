import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const databaseFile =
  process.env.DATABASE_FILE || "./data/game.db";

fs.mkdirSync(
  path.dirname(databaseFile),
  { recursive: true }
);

export const db =
  new Database(databaseFile);

db.pragma("journal_mode = WAL");


/* ================================
   TABLES
================================ */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT,
  name TEXT,
  avatar TEXT DEFAULT '🧑',
  lives INTEGER DEFAULT 100,
  score INTEGER DEFAULT 0,
  referrals INTEGER DEFAULT 0,
  character_created INTEGER DEFAULT 0,
  upgrades INTEGER DEFAULT 0,
  group_created INTEGER DEFAULT 0,
  last_life_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  day INTEGER,
  mission INTEGER,
  correct INTEGER,
  score INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, day, mission)
);

CREATE TABLE IF NOT EXISTS weekly_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  week TEXT,
  score INTEGER DEFAULT 0,
  UNIQUE(user_id, week)
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_id TEXT,
  invited_id TEXT UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  package_id TEXT,
  lives INTEGER,
  price REAL,
  currency TEXT DEFAULT 'USDT',
  status TEXT DEFAULT 'pending',
  tx_hash TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);


/* ================================
   MIGRATION
================================ */

function addColumnIfMissing(
  table,
  column,
  definition
) {

  const columns =
    db.prepare(
      `PRAGMA table_info(${table})`
    ).all();

  const exists =
    columns.some(
      columnInfo =>
        columnInfo.name === column
    );

  if (!exists) {

    db.exec(`
      ALTER TABLE ${table}
      ADD COLUMN ${column}
      ${definition}
    `);

  }

}


/*
  سازگاری با دیتابیس قدیمی
*/

addColumnIfMissing(
  "users",
  "name",
  "TEXT"
);

addColumnIfMissing(
  "users",
  "avatar",
  "TEXT DEFAULT '🧑'"
);

addColumnIfMissing(
  "users",
  "referrals",
  "INTEGER DEFAULT 0"
);

addColumnIfMissing(
  "users",
  "character_created",
  "INTEGER DEFAULT 0"
);

addColumnIfMissing(
  "users",
  "upgrades",
  "INTEGER DEFAULT 0"
);

addColumnIfMissing(
  "users",
  "group_created",
  "INTEGER DEFAULT 0"
);

addColumnIfMissing(
  "users",
  "created_at",
  "TEXT"
);


/* ================================
   LIFE REFILL
================================ */

export function refill(user) {

  if (!user) {
    return user;
  }

  const lastLifeTime =
    new Date(
      user.last_life_at || Date.now()
    ).getTime();

  const now =
    Date.now();

  const hoursPassed =
    Math.floor(
      (now - lastLifeTime) /
      3600000
    );

  const maxLives = 100;

  if (
    hoursPassed > 0 &&
    user.lives < maxLives
  ) {

    const newLives =
      Math.min(
        maxLives,
        user.lives + hoursPassed
      );

    db.prepare(`
      UPDATE users
      SET
        lives = ?,
        last_life_at = ?
      WHERE id = ?
    `).run(
      newLives,
      new Date().toISOString(),
      user.id
    );

    user.lives =
      newLives;
  }

  return user;
}
