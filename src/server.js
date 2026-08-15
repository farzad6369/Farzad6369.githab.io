import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db, refill } from "./db.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;


/* =========================================
   WORLD VAULT
   مسابقه ۷ روزه
========================================= */

const GAME_DURATION = 168 * 60 * 60 * 1000;

// زمان شروع را از .env می‌گیریم.
// اگر تعیین نشده باشد، سرور زمان فعلی را شروع مسابقه در نظر می‌گیرد.
const GAME_START = process.env.GAME_START
  ? new Date(process.env.GAME_START).getTime()
  : Date.now();

const GAME_END = GAME_START + GAME_DURATION;


/* =========================================
   HOME / HEALTH CHECK
========================================= */

app.get("/", (req, res) => {

  res.json({
    ok: true,
    game: "WORLD VAULT",
    status: "online",
    serverTime: new Date().toISOString()
  });

});


/* =========================================
   GAME STATUS
========================================= */

app.get("/api/game", (req, res) => {

  const now = Date.now();

  const remaining = Math.max(
    0,
    GAME_END - now
  );

  res.json({

    ok: true,

    game: "WORLD VAULT",

    start: new Date(
      GAME_START
    ).toISOString(),

    end: new Date(
      GAME_END
    ).toISOString(),

    remaining,

    finished: remaining <= 0,

    lastFiveHours:
      remaining <= 5 * 60 * 60 * 1000

  });

});


/* =========================================
   GET / CREATE USER
========================================= */

app.get("/api/user/:id", (req, res) => {

  try {

    const id = String(req.params.id);

    let user = db.prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `).get(id);


    /*
      اگر کاربر وجود نداشت،
      ایجاد می‌کنیم.
    */

    if (!user) {

      db.prepare(`
        INSERT INTO users
        (
          id,
          username,
          name,
          avatar,
          lives,
          score,
          last_life_at
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        null,
        "بازیکن",
        "🧑",
        100,
        0,
        new Date().toISOString()
      );

      user = db.prepare(`
        SELECT *
        FROM users
        WHERE id = ?
      `).get(id);

    }


    /*
      شارژ خودکار جان
    */

    user = refill(user);


    res.json({
      ok: true,
      user
    });


  } catch (error) {

    console.error(
      "USER ERROR:",
      error
    );

    res.status(500).json({

      ok: false,

      error: "USER_ERROR"

    });

  }

});


/* =========================================
   UPDATE PROFILE
========================================= */

app.post("/api/profile", (req, res) => {

  try {

    const {
      userId,
      name,
      username,
      avatar
    } = req.body;


    if (!userId) {

      return res.status(400).json({

        ok: false,

        error:
          "USER_ID_REQUIRED"

      });

    }


    db.prepare(`
      UPDATE users
      SET
        name = COALESCE(?, name),
        username = COALESCE(?, username),
        avatar = COALESCE(?, avatar)
      WHERE id = ?
    `).run(

      name || null,
      username || null,
      avatar || null,
      String(userId)

    );


    const user = db.prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `).get(
      String(userId)
    );


    res.json({

      ok: true,

      user

    });


  } catch (error) {

    console.error(
      "PROFILE ERROR:",
      error
    );

    res.status(500).json({

      ok: false,

      error:
        "PROFILE_ERROR"

    });

  }

});


/* =========================================
   SUBMIT ANSWER
========================================= */

app.post("/api/answer", (req, res) => {

  try {

    const {
      userId,
      day,
      mission,
      correct
    } = req.body;


    if (
      !userId ||
      day === undefined ||
      mission === undefined ||
      correct === undefined
    ) {

      return res.status(400).json({

        ok: false,

        error:
          "INVALID_ANSWER"

      });

    }


    /*
      بررسی زمان مسابقه
    */

    const now = Date.now();

    if (
      now < GAME_START ||
      now > GAME_END
    ) {

      return res.status(400).json({

        ok: false,

        error:
          "GAME_NOT_ACTIVE"

      });

    }


    const id =
      String(userId);


    const user = db.prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `).get(id);


    if (!user) {

      return res.status(404).json({

        ok: false,

        error:
          "USER_NOT_FOUND"

      });

    }


    /*
      جلوگیری از پاسخ دوباره
    */

    const already = db.prepare(`
      SELECT *
      FROM answers
      WHERE user_id = ?
      AND day = ?
      AND mission = ?
    `).get(
      id,
      Number(day),
      Number(mission)
    );


    if (already) {

      return res.status(400).json({

        ok: false,

        error:
          "ALREADY_ANSWERED"

      });

    }


    /*
      امتیاز سمت سرور محاسبه می‌شود.
    */

    let points = 0;


    if (Boolean(correct)) {

      if (Number(day) === 7) {

        points = 30;

      } else if (
        Number(mission) % 2 === 1
      ) {

        points = 20;

      } else {

        points = 10;

      }

    }


    /*
      جواب اشتباه = ۲ جان کم
    */

    const lifeCost =
      Boolean(correct)
        ? 0
        : 2;


    const newLives =
      Math.max(
        0,
        user.lives - lifeCost
      );


    const newScore =
      user.score + points;


    /*
      Transaction
    */

    const transaction =
      db.transaction(() => {


        db.prepare(`
          INSERT INTO answers
          (
            user_id,
            day,
            mission,
            correct,
            score
          )
          VALUES
          (?, ?, ?, ?, ?)
        `).run(

          id,
          Number(day),
          Number(mission),
          Boolean(correct) ? 1 : 0,
          points

        );


        db.prepare(`
          UPDATE users
          SET
            lives = ?,
            score = ?
          WHERE id = ?
        `).run(

          newLives,
          newScore,
          id

        );

      });


    transaction();


    res.json({

      ok: true,

      correct:
        Boolean(correct),

      points,

      lives:
        newLives,

      score:
        newScore

    });


  } catch (error) {

    console.error(
      "ANSWER ERROR:",
      error
    );

    res.status(500).json({

      ok: false,

      error:
        "ANSWER_ERROR"

    });

  }

});


/* =========================================
   USER SCORE
========================================= */

app.get("/api/score/:id", (req, res) => {

  try {

    const user = db.prepare(`
      SELECT
        id,
        name,
        username,
        score,
        lives
      FROM users
      WHERE id = ?
    `).get(
      String(req.params.id)
    );


    if (!user) {

      return res.status(404).json({

        ok: false,

        error:
          "USER_NOT_FOUND"

      });

    }


    res.json({

      ok: true,

      user

    });


  } catch (error) {

    console.error(
      "SCORE ERROR:",
      error
    );

    res.status(500).json({

      ok: false,

      error:
        "SCORE_ERROR"

    });

  }

});


/* =========================================
   LEADERBOARD
========================================= */

app.get("/api/leaderboard", (req, res) => {

  try {

    const players = db.prepare(`
      SELECT
        id,
        name,
        username,
        avatar,
        score
      FROM users
      ORDER BY score DESC
      LIMIT 100
    `).all();


    const result =
      players.map(
        (player, index) => ({

          rank: index + 1,

          id: player.id,

          name:
            player.name ||
            player.username ||
            "بازیکن",

          username:
            player.username,

          avatar:
            player.avatar ||
            "🧑",

          score:
            player.score || 0

        })
      );


    res.json({

      ok: true,

      players: result

    });


  } catch (error) {

    console.error(
      "LEADERBOARD ERROR:",
      error
    );

    res.status(500).json({

      ok: false,

      error:
        "LEADERBOARD_ERROR"

    });

  }

});


/* =========================================
   REFERRAL
========================================= */

app.post("/api/referral", (req, res) => {

  try {

    const {
      inviterId,
      invitedId
    } = req.body;


    if (!inviterId || !invitedId) {

      return res.status(400).json({

        ok: false,

        error:
          "INVALID_REFERRAL"

      });

    }


    if (
      String(inviterId) ===
      String(invitedId)
    ) {

      return res.status(400).json({

        ok: false,

        error:
          "SELF_REFERRAL"

      });

    }


    const invited =
      db.prepare(`
        SELECT id
        FROM users
        WHERE id = ?
      `).get(
        String(invitedId)
      );


    if (!invited) {

      return res.status(404).json({

        ok: false,

        error:
          "INVITED_USER_NOT_FOUND"

      });

    }


    const exists =
      db.prepare(`
        SELECT id
        FROM referrals
        WHERE invited_id = ?
      `).get(
        String(invitedId)
      );


    if (exists) {

      return res.status(400).json({

        ok: false,

        error:
          "REFERRAL_ALREADY_USED"

      });

    }


    const transaction =
      db.transaction(() => {

        db.prepare(`
          INSERT INTO referrals
          (
            inviter_id,
            invited_id
          )
          VALUES (?, ?)
        `).run(
          String(inviterId),
          String(invitedId)
        );


        db.prepare(`
          UPDATE users
          SET
            referrals =
            COALESCE(referrals, 0) + 1,
            lives =
            COALESCE(lives, 0) + 40
          WHERE id = ?
        `).run(
          String(inviterId)
        );

      });


    transaction();


    res.json({

      ok: true,

      reward:
        40,

      message:
        "40 lives added"

    });


  } catch (error) {

    console.error(
      "REFERRAL ERROR:",
      error
    );

    res.status(500).json({

      ok: false,

      error:
        "REFERRAL_ERROR"

    });

  }

});


/* =========================================
   PURCHASE
========================================= */

app.post("/api/purchase", (req, res) => {

  try {

    const {
      userId,
      packageId,
      lives,
      price
    } = req.body;


    if (
      !userId ||
      !packageId ||
      !lives ||
      !price
    ) {

      return res.status(400).json({

        ok: false,

        error:
          "INVALID_PURCHASE"

      });

    }


    const user =
      db.prepare(`
        SELECT id
        FROM users
        WHERE id = ?
      `).get(
        String(userId)
      );


    if (!user) {

      return res.status(404).json({

        ok: false,

        error:
          "USER_NOT_FOUND"

      });

    }


    const result =
      db.prepare(`
        INSERT INTO purchases
        (
          user_id,
          package_id,
          lives,
          price,
          currency,
          status
        )
        VALUES
        (?, ?, ?, ?, 'USDT', 'pending')
      `).run(

        String(userId),
        String(packageId),
        Number(lives),
        Number(price)

      );


    res.json({

      ok: true,

      purchaseId:
        result.lastInsertRowid,

      status:
        "pending",

      message:
        "Purchase created"

    });


  } catch (error) {

    console.error(
      "PURCHASE ERROR:",
      error
    );

    res.status(500).json({

      ok: false,

      error:
        "PURCHASE_ERROR"

    });

  }

});


/* =========================================
   404
========================================= */

app.use((req, res) => {

  res.status(404).json({

    ok: false,

    error:
      "NOT_FOUND"

  });

});


/* =========================================
   ERROR HANDLER
========================================= */

app.use(
  (error, req, res, next) => {

    console.error(error);

    res.status(500).json({

      ok: false,

      error:
        "SERVER_ERROR"

    });

  }
);


/* =========================================
   START SERVER
========================================= */

app.listen(
  PORT,
  () => {

    console.log(
      "================================"
    );

    console.log(
      "🌍 WORLD VAULT SERVER"
    );

    console.log(
      `🚀 Port: ${PORT}`
    );

    console.log(
      `🕐 Start: ${
        new Date(
          GAME_START
        ).toISOString()
      }`
    );

    console.log(
      `🏁 End: ${
        new Date(
          GAME_END
        ).toISOString()
      }`
    );

    console.log(
      "================================"
    );

  }
);
