import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db, refill } from './db.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health Check
app.get('/', (req, res) => {
  res.json({
    success: true,
    game: 'WORLD VAULT',
    status: 'online'
  });
});

// Get / create player
app.get('/api/user/:id', (req, res) => {
  try {
    const id = String(req.params.id);

    let user = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id);

    if (!user) {
      db.prepare(`
        INSERT INTO users
        (id, username, lives, score, last_life_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        id,
        '',
        10,
        0,
        new Date().toISOString()
      );

      user = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(id);
    }

    user = refill(user);

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Health check API
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    server: 'WORLD VAULT',
    time: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`WORLD VAULT SERVER running on port ${PORT}`);
});
