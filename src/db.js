import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const databaseFile = process.env.DATABASE_FILE || './data/game.db';

fs.mkdirSync(path.dirname(databaseFile), {
  recursive: true
});

export const db = new Database(databaseFile);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT DEFAULT '',
    lives INTEGER DEFAULT 10,
    score INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    map_fragments INTEGER DEFAULT 0,
    keys INTEGER DEFAULT 0,
    referral_count INTEGER DEFAULT 0,
    referral_reward_claimed INTEGER DEFAULT 0,
    world_seed TEXT,
    current_stage INTEGER DEFAULT 1,
    last_life_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    stage INTEGER,
    correct INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
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

  CREATE TABLE IF NOT EXISTS player_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    item_type TEXT,
    item_value INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Generate unique world seed
export function createWorldSeed() {
  return Math.random().toString(36).substring(2, 10)
    + Date.now().toString(36);
}

// Refill lives over time
export function refill(user) {
  const lastLifeTime = new Date(
    user.last_life_at || Date.now()
  ).getTime();

  const now = Date.now();

  const hoursPassed = Math.floor(
    (now - lastLifeTime) / 3600000
  );

  if (hoursPassed > 0 && user.lives < 10) {

    const newLives = Math.min(
      10,
      user.lives + hoursPassed
    );

    db.prepare(`
      UPDATE users
      SET lives = ?, last_life_at = ?
      WHERE id = ?
    `).run(
      newLives,
      new Date().toISOString(),
      user.id
    );

    user.lives = newLives;
    user.last_life_at = new Date().toISOString();
  }

  return user;
}

// Create player
export function createUser(id, username = '') {

  const seed = createWorldSeed();

  db.prepare(`
    INSERT INTO users
    (
      id,
      username,
      lives,
      score,
      streak,
      map_fragments,
      keys,
      referral_count,
      referral_reward_claimed,
      world_seed,
      current_stage,
      last_life_at
    )
    VALUES (?, ?, 10, 0, 0, 0, 0, 0, 0, ?, 1, ?)
  `).run(
    id,
    username,
    seed,
    new Date().toISOString()
  );

  return db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(id);
}

// Add score
export function addScore(userId, amount) {

  db.prepare(`
    UPDATE users
    SET score = score + ?
    WHERE id = ?
  `).run(amount, userId);

  return db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(userId);
}

// Add life
export function addLives(userId, amount) {

  db.prepare(`
    UPDATE users
    SET lives = MIN(10, lives + ?)
    WHERE id = ?
  `).run(amount, userId);

  return db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(userId);
}

// Add map fragment
export function addMapFragment(userId) {

  db.prepare(`
    UPDATE users
    SET map_fragments = map_fragments + 1
    WHERE id = ?
  `).run(userId);

  return db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(userId);
}

// Add key
export function addKey(userId) {

  db.prepare(`
    UPDATE users
    SET keys = keys + 1
    WHERE id = ?
  `).run(userId);

  return db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(userId);
}

// Advance stage
export function nextStage(userId) {

  db.prepare(`
    UPDATE users
    SET current_stage = current_stage + 1
    WHERE id = ?
  `).run(userId);

  return db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(userId);
}

// Referral reward
// 5 successful referrals = 50 lives
export function addReferral(inviterId, invitedId) {

  const existing = db
    .prepare(`
      SELECT id
      FROM referrals
      WHERE invited_id = ?
    `)
    .get(invitedId);

  if (existing) {
    return {
      success: false,
      message: 'Referral already registered'
    };
  }

  const inviter = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(inviterId);

  const invited = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(invitedId);

  if (!inviter || !invited) {
    return {
      success: false,
      message: 'User not found'
    };
  }

  if (inviterId === invitedId) {
    return {
      success: false,
      message: 'Self referral is not allowed'
    };
  }

  db.prepare(`
    INSERT INTO referrals
    (inviter_id, invited_id)
    VALUES (?, ?)
  `).run(inviterId, invitedId);

  const newCount = inviter.referral_count + 1;

  db.prepare(`
    UPDATE users
