import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import {
  db,
  refill,
  createUser,
  addScore,
  addLives,
  addMapFragment,
  addKey,
  nextStage,
  addReferral
} from './db.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===============================
// HOME
// ===============================

app.get('/', (req, res) => {
  res.json({
    success: true,
    game: 'WORLD VAULT',
    status: 'online',
    version: '1.0.0'
  });
});

// ===============================
// HEALTH
// ===============================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    server: 'WORLD VAULT',
    time: new Date().toISOString()
  });
});

// ===============================
// GET / CREATE USER
// ===============================

app.get('/api/user/:id', (req, res) => {

  try {

    const id = String(req.params.id);

    let user = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id);

    if (!user) {
      user = createUser(id);
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
      error: 'USER_ERROR'
    });

  }

});

// ===============================
// ADD SCORE
// ===============================

app.post('/api/score', (req, res) => {

  try {

    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DATA'
      });
    }

    const score = Math.max(
      0,
      Math.min(Number(amount), 1000)
    );

    const user = addScore(
      String(userId),
      score
    );

    res.json({
      success: true,
      score: user.score
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      error: 'SCORE_ERROR'
    });

  }

});

// ===============================
// ADD LIFE
// ===============================

app.post('/api/lives/add', (req, res) => {

  try {

    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DATA'
      });
    }

    const lives = Math.max(
      1,
      Math.min(Number(amount), 50)
    );

    const user = addLives(
      String(userId),
      lives
    );

    res.json({
      success: true,
      lives: user.lives
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      error: 'LIFE_ERROR'
    });

  }

});

// ===============================
// MAP FRAGMENT
// ===============================

app.post('/api/map/found', (req, res) => {

  try {

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_USER'
      });
    }

    const user = addMapFragment(
      String(userId)
    );

    res.json({
      success: true,
      mapFragments: user.map_fragments
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      error: 'MAP_ERROR'
    });

  }

});

// ===============================
// KEY
// ===============================

app.post('/api/key/found', (req, res) => {

  try {

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_USER'
      });
    }

    const user = addKey(
      String(userId)
    );

    res.json({
      success: true,
      keys: user.keys
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      error: 'KEY_ERROR'
    });

  }

});

// ===============================
// NEXT STAGE
// ===============================

app.post('/api/stage/next', (req, res) => {

  try {

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_USER'
      });
    }

    const user = nextStage(
      String(userId)
    );

    res.json({
      success: true,
      stage: user.current_stage
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      error: 'STAGE_ERROR'
    });

  }

});

// ===============================
// REFERRAL
// ===============================

app.post('/api/referral', (req, res) => {

  try {

    const {
      inviterId,
      invitedId
    } = req.body;

    if (!inviterId || !invitedId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DATA'
      });
    }

    const result = addReferral(
      String(inviterId),
      String(invitedId)
    );

    res.json(result);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      error: 'REFERRAL_ERROR'
    });

  }

});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {

  console.log(
    `🌍 WORLD VAULT SERVER running on port ${PORT}`
  );

});
