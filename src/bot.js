import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (token) {
  const bot = new TelegramBot(token, { polling: true });
  bot.onText(/\/start/, (msg) => bot.sendMessage(msg.chat.id, 'به بازی خوش آمدید!'));
  console.log('Bot is running');
}
