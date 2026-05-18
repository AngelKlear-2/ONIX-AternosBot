require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_TOKEN не найден в .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

console.log('Отправьте боту любое сообщение. После первого ответа скрипт завершится.');

bot.once('message', async (message) => {
  const chatId = String(message.chat.id);
  console.log(`Ваш ADMIN_CHAT_ID: ${chatId}`);

  try {
    await bot.sendMessage(message.chat.id, `Ваш ADMIN_CHAT_ID: ${chatId}`);
  } finally {
    await bot.stopPolling().catch(() => {});
    process.exit(0);
  }
});
