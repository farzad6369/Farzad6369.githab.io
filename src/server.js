
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { db, refill, week } from './db.js';
import './bot.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const makeId = () => crypto.randomUUID();
const makeReferralCode = () =>
  crypto.randomBytes(4).toString('hex').toUpperCase();

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'world-treasure-backend'
  });
});

app.post('/api/users', (req, res) => {
  const {
    id: userId,
    username = '',
    language = 'fa',
    gender = '',
    referralCode
  } = req.body;

  const uid = userId || makeId();

  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);

  if (!user) {
    let referredBy = null;

    if (referralCode) {
      const refUser = db
        .prepare('SELECT id FROM users WHERE referral_code = ?')
        .get(referralCode);

      referredBy = refUser ? refUser.id : null;
    }

    db.prepare(`
      INSERT INTO users (
        id,
        username,
        language,
        gender,
        referral_code,
        referred_by,
        last_life_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uid,
      username,
      language,
      gender,
      makeReferralCode(),
      referredBy,
      new Date().toISOString()
    );

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  } else {
    db.prepare(`
      UPDATE users
      SET username = ?, language = ?, gender = ?
      WHERE id = ?
    `).run(username, language, gender, uid);

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  }

  res.json(refill(user));
});

app.get('/api/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  res.json(refill(user));
});

app.post('/api/game/answer', (req, res) => {
  const { userId, stage, correct } = req.body;

  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  if (!user) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  user = refill(user);

  if (user.lives <= 0) {
    return res.status(400).json({ error: 'no_lives' });
  }

  const isCorrect = Boolean(correct);
  const gainedScore = isCorrect ? 100 : 0;

  db.prepare(`
    UPDATE users
    SET
      lives = lives - 1,
      stage = CASE WHEN ? = 1 AND stage <= ? THEN stage + 1 ELSE stage END,
      score = score + ?
    WHERE id = ?
  `).run(isCorrect ? 1 : 0, stage, gainedScore, userId);

  db.prepare(`
    INSERT INTO answers (user_id, stage, correct, score)
    VALUES (?, ?, ?, ?)
  `).run(userId, stage, isCorrect ? 1 : 0, gainedScore);

  const currentWeek = week();

  db.prepare(`
    INSERT INTO weekly_scores (user_id, week, score)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, week)
    DO UPDATE SET score = score + excluded.score
  `).run(userId, currentWeek, gainedScore);

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  res.json({
    correct: isCorrect,
    score: gainedScore,
    user: refill(updatedUser)
  });
});

app.post('/api/referrals/claim', (req, res) => {
  const { userId, referralCode } = req.body;

  const refUser = db
    .prepare('SELECT id FROM users WHERE referral_code = ?')
    .get(referralCode);

  if (!refUser || refUser.id === userId) {
    return res.status(400).json({ error: 'invalid_referral' });
  }

  db.prepare(`
    UPDATE users
    SET referred_by = ?
    WHERE id = ? AND referred_by IS NULL
  `).run(refUser.id, userId);

  res.json({ ok: true });
});

app.get('/api/leaderboard/weekly', (req, res) => {
  const rows = db.prepare(`
    SELECT u.username, w.score
    FROM weekly_scores w
    JOIN users u ON u.id = w.user_id
    WHERE w.week = ?
    ORDER BY w.score DESC
    LIMIT 100
  `).all(week());

  res.json(rows);
});

app.post('/api/payments/submit', (req, res) => {
  const { userId, txid, product, amountUsdt } = req.body;

  if (!userId || !txid || !product) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO payments (user_id, txid, product, amount_usdt)
      VALUES (?, ?, ?, ?)
    `).run(userId, txid.trim(), product, Number(amountUsdt));

    res.json({
      ok: true,
      paymentId: result.lastInsertRowid,
      status: 'pending'
    });
  } catch (error) {
    res.status(409).json({ error: 'txid_already_submitted' });
  }
});

app.post('/api/admin/payments/:id/approve', (req, res) => {
  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);

  if (!payment) {
    return res.status(404).json({ error: 'not_found' });
  }

  db.prepare(`
    UPDATE payments
    SET status = 'approved', approved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(payment.id);

  const livesMap = {
    life20: 20,
    life40: 40,
    life50: 50,
    life100: 100
  };

  const extraLives = livesMap[payment.product] || 0;

  if (extraLives) {
    db.prepare(`
      UPDATE users
      SET lives = MIN(max_lives, lives + ?)
      WHERE id = ?
    `).run(extraLives, payment.user_id);
  }

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`World Treasure API running on port ${PORT}`);
});
