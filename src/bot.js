import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const token =
  process.env.TELEGRAM_BOT_TOKEN;

const webAppUrl =
  process.env.WEB_APP_URL;


if (!token) {

  console.log(
    "⚠️ TELEGRAM_BOT_TOKEN is empty"
  );

} else if (!webAppUrl) {

  console.log(
    "⚠️ WEB_APP_URL is empty"
  );

} else {

  const bot =
    new TelegramBot(
      token,
      { polling: true }
    );


  /* ================================
     START
  ================================= */

  bot.onText(
    /\/start(?: (.+))?/,
    async (message, match) => {

      const chatId =
        message.chat.id;

      const firstName =
        message.from?.first_name ||
        "بازیکن";


      const referralCode =
        match?.[1] || "";


      let text =
`🌍 WORLD VAULT

سلام ${firstName} 👋

🏆 مسابقه بزرگ ۷ روزه
🎯 ۷۰ مأموریت
❤️ سیستم جان
🏅 لیدربورد جهانی
💰 جایزه نفرات برتر

برای ورود به گنجینه آماده‌ای؟`;


      if (referralCode) {

        text +=
          `\n\n🎁 کد دعوت شما:
${referralCode}`;

      }


      await bot.sendMessage(
        chatId,
        text,
        {
          reply_markup: {

            inline_keyboard: [

              [
                {
                  text:
                    "🎮 شروع بازی",
                  web_app: {
                    url:
                      webAppUrl
                  }
                }
              ],

              [
                {
                  text:
                    "🏆 لیدربورد",
                  web_app: {
                    url:
                      webAppUrl +
                      "?page=leaderboard"
                  }
                }
              ]

            ]

          }

        }
      );

    }
  );


  /* ================================
     HELP
  ================================= */

  bot.onText(
    /\/help/,
    async (message) => {

      await bot.sendMessage(
        message.chat.id,

`🌍 WORLD VAULT

🎮 /start
شروع بازی

🏆 /leaderboard
مشاهده رتبه‌بندی

ℹ️ /help
راهنما`
      );

    }
  );


  /* ================================
     LEADERBOARD
  ================================= */

  bot.onText(
    /\/leaderboard/,
    async (message) => {

      await bot.sendMessage(

        message.chat.id,

`🏆 لیدربورد WORLD VAULT

برای مشاهده رتبه‌بندی کامل، روی دکمه زیر بزنید.`,

        {

          reply_markup: {

            inline_keyboard: [

              [
                {
                  text:
                    "🏆 مشاهده لیدربورد",

                  web_app: {
                    url:
                      webAppUrl +
                      "?page=leaderboard"
                  }

                }

              ]

            ]

          }

        }

      );

    }
  );


  /* ================================
     ERRORS
  ================================= */

  bot.on(
    "polling_error",
    (error) => {

      console.error(
        "Telegram Bot Error:",
        error.message
      );

    }
  );


  console.log(
    "🤖 WORLD VAULT Telegram Bot is running"
  );

}
