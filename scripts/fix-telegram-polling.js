require('dotenv').config();
const https = require('node:https');

const token = process.env.TELEGRAM_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_TOKEN не найден в .env');
  process.exit(1);
}

function request(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => resolve(body));
      })
      .on('error', reject);
  });
}

async function main() {
  const allowedUpdates = encodeURIComponent(JSON.stringify(['message', 'callback_query']));
  const deleteWebhookUrl = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
  const getUpdatesUrl = `https://api.telegram.org/bot${token}/getUpdates?offset=-1&allowed_updates=${allowedUpdates}`;
  const webhookInfoUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;

  console.log('1. deleteWebhook:');
  console.log(await request(deleteWebhookUrl));

  console.log('\n2. getUpdates reset:');
  console.log((await request(getUpdatesUrl)).slice(0, 200));

  console.log('\n3. getWebhookInfo:');
  console.log(await request(webhookInfoUrl));

  console.log('\n✅ Готово. Теперь можно запускать npm run test-telegram или npm start');
}

main().catch((error) => {
  console.error(`❌ Ошибка: ${error.message}`);
  process.exit(1);
});
