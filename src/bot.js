import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (token) {
  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start(?: (.+))?/, (message) => {
    bot.sendMessage(message.chat.id, 'به گنجینه جهانی خوش آمدید! برای شروع بازی، وب‌اپ را باز کنید.');
  });

  bot.on('polling_error', (error) => console.error('Telegram bot error:', error.message));
  console.log('Telegram bot is running');
} else {
  console.log('Telegram bot is disabled because TELEGRAM_BOT_TOKEN is empty');
}
