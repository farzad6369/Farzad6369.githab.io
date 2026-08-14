import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db, refill, week } from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;

app.get('/api/user/:id', (req, res) => {
  const { id } = req.params;
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

  if (!user) {
    const referralCode = Math.random().toString(36).substring(2, 8);
    db.prepare(`
      INSERT INTO users (id, referral_code, last_life_at)
      VALUES (?, ?, ?)
    `).run(id, referralCode, new Date().toISOString());
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  user = refill(user);
  res.json(user);
});

app.post('/api/answer', (req, res) => {
  const { user_id, stage, correct, score } = req.body;
  
  db.prepare(`
    INSERT INTO answers (user_id, stage, correct, score)
    VALUES (?, ?, ?, ?)
  `).run(user_id, stage, correct ? 1 : 0, score);

  if (correct) {
    db.prepare(`
      UPDATE users 
      SET score = score + ?, stage = MAX(stage, ?)
      WHERE id = ?
    `).run(score, stage, user_id);

    const currentWeek = week();
    db.prepare(`
      INSERT INTO weekly_scores (user_id, week, score)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, week) DO UPDATE SET score = score + ?
    `).run(user_id, currentWeek, score, score);
  } else {
    db.prepare('UPDATE users SET lives = MAX(0, lives - 1) WHERE id = ?').run(user_id);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  res.json(refill(user));
});

app.get('/api/leaderboard', (req, res) => {
  const currentWeek = week();
  const top = db.prepare(`
    SELECT u.username, w.score
    FROM weekly_scores w
    JOIN users u ON w.user_id = u.id
    WHERE w.week = ?
    ORDER BY w.score DESC
    LIMIT 10
  `).all(currentWeek);
  res.json(top);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
