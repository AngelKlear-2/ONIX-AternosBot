require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_TOKEN;
const adminChatId = process.env.ADMIN_CHAT_ID;

if (!token) {
  console.error('❌ TELEGRAM_TOKEN не найден в .env');
  process.exit(1);
}

const bot = new TelegramBot(token, {
  polling: {
    params: {
      allowed_updates: ['message', 'callback_query']
    }
  }
});

console.log('Тестовый бот запущен. Отправьте /test вашему боту.');
if (adminChatId) {
  console.log(`Ожидаемый ADMIN_CHAT_ID: ${adminChatId}`);
}

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
});

bot.on('message', async (message) => {
  console.log(`[MESSAGE] chat=${message.chat.id} text="${message.text || ''}"`);

  if (message.text !== '/test') {
    return;
  }

  try {
    await bot.sendMessage(message.chat.id, 'Проверка inline-кнопки:', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Проверить callback', callback_data: 'test_click' }]]
      }
    });
    console.log('[OK] Сообщение с кнопкой отправлено.');
  } catch (error) {
    console.error('[ERR] Ошибка отправки сообщения:', error.message);
  }
});

bot.on('callback_query', async (query) => {
  console.log(`[CALLBACK] data="${query.data}" from=${query.from.id}`);

  try {
    await bot.answerCallbackQuery(query.id, { text: 'Callback работает' });
    await bot.sendMessage(query.message.chat.id, '✅ Callback-кнопка работает.');
  } catch (error) {
    console.error('[ERR] Ошибка обработки callback:', error.message);
  }
});
