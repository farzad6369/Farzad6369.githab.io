import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db, refill } from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/user/:id', (req, res) => {
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    db.prepare('INSERT INTO users (id, last_life_at) VALUES (?, ?)').run(req.params.id, new Date().toISOString());
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  }
  res.json(refill(user));
});

app.listen(process.env.PORT || 3000, () => console.log('Server running...'));
