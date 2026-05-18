const TelegramBot = require('node-telegram-bot-api');
const {
  AUTH_MODES,
  loadConfig,
  validateProcessConfig,
  validateMinecraftConfig
} = require('./config');
const { createLogger } = require('./logger');
const { MinecraftController } = require('./minecraft-controller');
const { getEnvPath, updateEnvValue } = require('./persistence');
const {
  buildHelpText,
  buildLogsText,
  buildMainMenu,
  buildSettingsMenu,
  buildServerSettingsMenu,
  buildAuthSettingsMenu,
  buildNickSettingsMenu,
  buildBehaviorSettingsMenu
} = require('./telegram/menus');

const appConfig = loadConfig();
const missingFields = validateProcessConfig(appConfig);

if (missingFields.length > 0) {
  console.error(`❌ Отсутствуют обязательные переменные: ${missingFields.join(', ')}`);
  process.exit(1);
}

if (!appConfig.minecraft.host) {
  console.warn('⚠️ MC_HOST не задан — настройте сервер через меню ⚙️ → 🖥 Сервер в Telegram.');
}

if (!appConfig.minecraft.registerPassword &&
    (appConfig.minecraft.authMode === 'FORCED' || appConfig.minecraft.authMode === 'AUTO')) {
  console.warn(`⚠️ MC_REGISTER_PASS не задан, но MC_AUTH_MODE=${appConfig.minecraft.authMode}. Авторизация не будет работать.`);
}

const envPath = getEnvPath(process.cwd());
const logger = createLogger(appConfig.logging.maxLines);
const minecraftConfig = { ...appConfig.minecraft };

const state = {
  status: 'offline',
  waitingForPassword: false,
  waitingForNickname: false,
  waitingForHost: false,
  waitingForPort: false,
  waitingForVersion: false,
  lastMenuChatId: null,
  lastMenuMessageId: null,
  menuUpdating: false,
  menuPendingRefresh: false
};

const bot = new TelegramBot(appConfig.telegram.token, {
  polling: {
    params: {
      allowed_updates: appConfig.telegram.allowedUpdates
    }
  }
});

function isAdminChat(chatId) {
  return String(chatId) === appConfig.telegram.adminChatId;
}

function isAdminUser(userId) {
  if (!appConfig.telegram.adminUserId) {
    return true;
  }

  return String(userId) === appConfig.telegram.adminUserId;
}

function hasAdminAccess(chatId, userId) {
  return isAdminChat(chatId) && isAdminUser(userId);
}

function resetWaitingState() {
  state.waitingForPassword = false;
  state.waitingForNickname = false;
  state.waitingForHost = false;
  state.waitingForPort = false;
  state.waitingForVersion = false;
}

async function sendMessage(chatId, text, options = {}) {
  try {
    return await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      ...options
    });
  } catch (error) {
    logger.add(`Ошибка sendMessage: ${error.message}`);
    return null;
  }
}

async function sendEphemeralMessage(chatId, text, ttlMs, options = {}) {
  try {
    const sentMessage = await sendMessage(chatId, text, options);

    if (sentMessage && ttlMs > 0) {
      setTimeout(() => {
        bot.deleteMessage(chatId, sentMessage.message_id).catch(() => {});
      }, ttlMs);
    }

    return sentMessage;
  } catch (error) {
    logger.add(`Ошибка отправки в Telegram: ${error.message}`);
    return null;
  }
}

function notifyAdmin(text, opts = {}) {
  if (opts.persistent) {
    return sendMessage(appConfig.telegram.adminChatId, text);
  }
  return sendEphemeralMessage(
    appConfig.telegram.adminChatId,
    text,
    appConfig.telegram.notificationTtlMs
  );
}

function persistConfigValue(key, value) {
  updateEnvValue(envPath, key, value);
}

function stripHtmlTags(s) {
  return String(s).replace(/<[^>]*>/g, '');
}

async function renderMenu(chatId, messageId, menuFactory) {
  const menu = menuFactory();

  if (messageId) {
    try {
      await bot.editMessageText(menu.text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: menu.markup
      });

      if (menuFactory === getMainMenu) {
        state.lastMenuChatId = chatId;
        state.lastMenuMessageId = messageId;
      }

      return;
    } catch (error) {
      const description = error?.response?.body?.description || '';
      if (description.includes('message is not modified')) {
        return;
      }
      if (description.includes("can't parse entities") || description.includes('parse entities')) {
        logger.add(`Меню: HTML сломан (${description.slice(0, 80)}). Шлю plain.`);
        try {
          await bot.editMessageText(stripHtmlTags(menu.text), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: menu.markup
          });
          if (menuFactory === getMainMenu) {
            state.lastMenuChatId = chatId;
            state.lastMenuMessageId = messageId;
          }
          return;
        } catch (fallbackError) {
          logger.add(`Меню plain также не отправилось: ${fallbackError.message}`);
          return;
        }
      }
      logger.add(`Ошибка обновления меню: ${error.message}`);
      return;
    }
  }

  try {
    const sent = await sendMessage(chatId, menu.text, { reply_markup: menu.markup });

    if (menuFactory === getMainMenu && sent) {
      state.lastMenuChatId = chatId;
      state.lastMenuMessageId = String(sent.message_id);
    }
  } catch (error) {
    logger.add(`Ошибка отправки меню: ${error.message}`);
  }
}

function getMainMenu() {
  const phase = minecraft.reconnectAttempts >= minecraftConfig.slowRetryAfterAttempts
    ? 'slow'
    : 'fast';
  return buildMainMenu({
    status: state.status,
    minecraft: minecraftConfig,
    activeUsername: minecraft.activeUsername,
    reconnectAttempt: minecraft.reconnectAttempts,
    reconnectPhase: phase,
    uptimeInfo: typeof minecraft.getUptimeInfo === 'function' ? minecraft.getUptimeInfo() : null
  });
}

function getSettingsMenu() {
  return buildSettingsMenu({
    minecraft: minecraftConfig,
    activeUsername: minecraft.activeUsername
  });
}

function getServerSettingsMenu() {
  return buildServerSettingsMenu({ minecraft: minecraftConfig });
}

function getAuthSettingsMenu() {
  return buildAuthSettingsMenu({ minecraft: minecraftConfig });
}

function getNickSettingsMenu() {
  return buildNickSettingsMenu({
    minecraft: minecraftConfig,
    activeUsername: minecraft.activeUsername
  });
}

function getBehaviorSettingsMenu() {
  return buildBehaviorSettingsMenu({ minecraft: minecraftConfig });
}

async function refreshMainMenu() {
  if (!state.lastMenuChatId || !state.lastMenuMessageId) {
    return;
  }

  if (state.menuUpdating) {
    state.menuPendingRefresh = true;
    return;
  }

  state.menuUpdating = true;
  state.menuPendingRefresh = false;

  try {
    await renderMenu(state.lastMenuChatId, state.lastMenuMessageId, getMainMenu);
  } finally {
    state.menuUpdating = false;
    if (state.menuPendingRefresh) {
      state.menuPendingRefresh = false;
      refreshMainMenu();
    }
  }
}

function getNextAuthMode(currentMode) {
  const currentIndex = AUTH_MODES.indexOf(currentMode);
  return AUTH_MODES[(currentIndex + 1) % AUTH_MODES.length];
}

const minecraft = new MinecraftController({
  config: minecraftConfig,
  logger,
  notifyAdmin,
  onStatusChange(nextStatus) {
    state.status = nextStatus;
    refreshMainMenu();
  }
});

bot.on('polling_error', (error) => {
  const code = error.code || '';
  const message = error.message || '';
  const statusCode = error?.response?.statusCode || 0;

  if (code === 'ETELEGRAM' && message.includes('409 Conflict')) {
    logger.add('Ошибка: запущен другой экземпляр бота с этим токеном. Остановите его и перезапустите.');
    Promise.resolve(notifyAdmin('⚠️ Обнаружен дубликат бота. Остановите другой экземпляр и перезапустите.', { persistent: true }))
      .catch(() => {})
      .finally(() => {
        bot.stopPolling().catch(() => {}).finally(() => {
          setTimeout(() => process.exit(1), 500);
        });
      });
    return;
  }

  if (statusCode === 429 || message.includes('429')) {
    logger.add('Telegram rate limit (429). Пауза 30 секунд.');
    bot.stopPolling().catch(() => {}).finally(() => {
      setTimeout(() => {
        bot.startPolling().catch((err) => {
          logger.add(`Ошибка возобновления polling: ${err.message}`);
        });
      }, 30000);
    });
    return;
  }

  if (['ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) {
    logger.add(`Telegram сеть: ${code} — продолжаю работу.`);
    return;
  }

  if (code === 'EFATAL') {
    logger.add(`Ошибка сети Telegram: ${message}`);
    return;
  }

  logger.add(`Telegram polling: ${code} ${message}`.trim());
});

bot.on('message', async (message) => {
  const chatId = String(message.chat.id);
  const userId = message.from?.id;
  const text = typeof message.text === 'string' ? message.text.trim() : '';

  if (!hasAdminAccess(chatId, userId)) {
    return;
  }

  if (state.waitingForPassword && text && !text.startsWith('/')) {
    state.waitingForPassword = false;
    minecraftConfig.registerPassword = text;
    persistConfigValue('MC_REGISTER_PASS', text);
    bot.deleteMessage(chatId, message.message_id).catch(() => {});
    await notifyAdmin('✅ Пароль обновлён.');
    return;
  }

  if (state.waitingForNickname && text && !text.startsWith('/')) {
    if (!/^[A-Za-z0-9_]{3,16}$/.test(text)) {
      await notifyAdmin('⚠️ Ник должен содержать 3-16 символов: латиница, цифры и _.');
      return;
    }

    state.waitingForNickname = false;
    minecraftConfig.username = text;
    minecraftConfig.nickMode = 'STATIC';
    persistConfigValue('MC_USERNAME', text);
    persistConfigValue('MC_NICK_MODE', 'STATIC');
    bot.deleteMessage(chatId, message.message_id).catch(() => {});
    await notifyAdmin('✅ Ник обновлён.');
    return;
  }

  if (state.waitingForHost && text && !text.startsWith('/')) {
    let hostPart = text.trim();
    let portPart = null;

    const colonIdx = hostPart.lastIndexOf(':');
    if (colonIdx !== -1) {
      const tail = hostPart.slice(colonIdx + 1).trim();
      const head = hostPart.slice(0, colonIdx).trim();
      const parsedPort = Number.parseInt(tail, 10);
      if (Number.isFinite(parsedPort) && String(parsedPort) === tail && parsedPort >= 1 && parsedPort <= 65535) {
        hostPart = head;
        portPart = parsedPort;
      }
    }

    if (!/^[A-Za-z0-9.-]{3,253}$/.test(hostPart)) {
      await notifyAdmin('⚠️ Хост должен содержать только буквы, цифры, точки и дефисы (3–253 символа).');
      return;
    }

    state.waitingForHost = false;
    minecraftConfig.host = hostPart;
    persistConfigValue('MC_HOST', hostPart);

    let portNote = '';
    if (portPart !== null) {
      minecraftConfig.port = portPart;
      persistConfigValue('MC_PORT', String(portPart));
      portNote = `, порт <code>${portPart}</code>`;
    }

    bot.deleteMessage(chatId, message.message_id).catch(() => {});
    const restartNote = minecraft.started ? ' Перезапустите бота для применения.' : '';
    await notifyAdmin(`✅ Сервер обновлён: <code>${hostPart}</code>${portNote}.${restartNote}`);
    await refreshMainMenu();
    return;
  }

  if (state.waitingForPort && text && !text.startsWith('/')) {
    const port = Number.parseInt(text, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      await notifyAdmin('⚠️ Порт должен быть числом от 1 до 65535.');
      return;
    }

    state.waitingForPort = false;
    minecraftConfig.port = port;
    persistConfigValue('MC_PORT', String(port));
    bot.deleteMessage(chatId, message.message_id).catch(() => {});
    const restartNote = minecraft.started ? ' Перезапустите бота для применения.' : '';
    await notifyAdmin(`✅ Порт обновлён: <code>${port}</code>.${restartNote}`);
    await refreshMainMenu();
    return;
  }

  if (state.waitingForVersion && text && !text.startsWith('/')) {
    const normalized = text.toLowerCase() === 'auto' || text === '-' ? '' : text;
    if (normalized && !/^[0-9]+\.[0-9]+(\.[0-9]+)?$/.test(normalized)) {
      await notifyAdmin('⚠️ Версия должна быть в формате 1.20 или 1.20.1. Введите <code>auto</code> для автодетекта.');
      return;
    }

    state.waitingForVersion = false;
    minecraftConfig.version = normalized || false;
    persistConfigValue('MC_VERSION', normalized);
    bot.deleteMessage(chatId, message.message_id).catch(() => {});
    const restartNote = minecraft.started ? ' Перезапустите бота для применения.' : '';
    const shown = normalized || 'auto';
    await notifyAdmin(`✅ Версия обновлена: <code>${shown}</code>.${restartNote}`);
    await refreshMainMenu();
    return;
  }

  if (text === '/start' || text === '/menu') {
    resetWaitingState();
    await renderMenu(chatId, null, getMainMenu);
    return;
  }

  if (text === '/status') {
    resetWaitingState();
    await renderMenu(chatId, null, getMainMenu);
    return;
  }

  if (text === '/help') {
    resetWaitingState();
    await sendMessage(chatId, buildHelpText());
    return;
  }

  if (text.startsWith('/')) {
    await sendEphemeralMessage(
      chatId,
      'ℹ️ Неизвестная команда. Используйте /menu или /help.',
      appConfig.telegram.notificationTtlMs
    );
  }
});

bot.on('callback_query', async (query) => {
  const callbackChatId = query.message?.chat?.id;
  const callbackUserId = query.from?.id;

  if (!callbackChatId || !hasAdminAccess(callbackChatId, callbackUserId)) {
    await bot.answerCallbackQuery(query.id, {
      text: 'Нет доступа',
      show_alert: true
    }).catch(() => {});
    return;
  }

  const chatId = String(callbackChatId);
  const messageId = query.message.message_id;

  try {
    switch (query.data) {
      case 'cmd_start': {
        const mcMissing = validateMinecraftConfig({ minecraft: minecraftConfig });
        if (mcMissing.length > 0) {
          await sendEphemeralMessage(
            chatId,
            `⚠️ Не задан сервер:\n• ${mcMissing.join('\n• ')}`,
            appConfig.telegram.notificationTtlMs
          );
          break;
        }
        minecraft.start();
        await renderMenu(chatId, messageId, getMainMenu);
        break;
      }

      case 'cmd_stop':
        minecraft.stop('Отключен администратором');
        await renderMenu(chatId, messageId, getMainMenu);
        break;

      case 'open_settings':
        resetWaitingState();
        await renderMenu(chatId, messageId, getSettingsMenu);
        break;

      case 'open_server_settings':
        resetWaitingState();
        await renderMenu(chatId, messageId, getServerSettingsMenu);
        break;

      case 'open_auth_settings':
        resetWaitingState();
        await renderMenu(chatId, messageId, getAuthSettingsMenu);
        break;

      case 'open_nick_settings':
        resetWaitingState();
        await renderMenu(chatId, messageId, getNickSettingsMenu);
        break;

      case 'open_behavior_settings':
        resetWaitingState();
        await renderMenu(chatId, messageId, getBehaviorSettingsMenu);
        break;

      case 'toggle_avoid_mobs':
        resetWaitingState();
        minecraftConfig.avoidMobs = !minecraftConfig.avoidMobs;
        persistConfigValue('MC_AVOID_MOBS', minecraftConfig.avoidMobs ? 'true' : 'false');
        logger.add(`Избегание мобов: ${minecraftConfig.avoidMobs ? 'вкл' : 'выкл'}.`);
        await renderMenu(chatId, messageId, getBehaviorSettingsMenu);
        break;

      case 'toggle_avoid_cliffs':
        resetWaitingState();
        minecraftConfig.avoidCliffs = !minecraftConfig.avoidCliffs;
        persistConfigValue('MC_AVOID_CLIFFS', minecraftConfig.avoidCliffs ? 'true' : 'false');
        logger.add(`Избегание обрывов: ${minecraftConfig.avoidCliffs ? 'вкл' : 'выкл'}.`);
        await renderMenu(chatId, messageId, getBehaviorSettingsMenu);
        break;

      case 'toggle_avoid_water':
        resetWaitingState();
        minecraftConfig.avoidWater = !minecraftConfig.avoidWater;
        persistConfigValue('MC_AVOID_WATER', minecraftConfig.avoidWater ? 'true' : 'false');
        logger.add(`Избегание воды: ${minecraftConfig.avoidWater ? 'вкл' : 'выкл'}.`);
        await renderMenu(chatId, messageId, getBehaviorSettingsMenu);
        break;

      case 'back_to_settings':
        resetWaitingState();
        await renderMenu(chatId, messageId, getSettingsMenu);
        break;

      case 'back_to_main':
        resetWaitingState();
        await renderMenu(chatId, messageId, getMainMenu);
        break;

      case 'toggle_mode':
        resetWaitingState();
        minecraftConfig.authMode = getNextAuthMode(minecraftConfig.authMode);
        persistConfigValue('MC_AUTH_MODE', minecraftConfig.authMode);
        logger.add(`Режим авторизации изменён на ${minecraftConfig.authMode}.`);
        await renderMenu(chatId, messageId, getAuthSettingsMenu);
        break;

      case 'change_password':
        state.waitingForPassword = true;
        state.waitingForNickname = false;
        await sendEphemeralMessage(
          chatId,
          '👇 Отправьте новый пароль следующим сообщением.',
          appConfig.telegram.notificationTtlMs
        );
        break;

      case 'toggle_nick_mode':
        resetWaitingState();
        minecraftConfig.nickMode = minecraftConfig.nickMode === 'STATIC' ? 'RANDOM' : 'STATIC';
        persistConfigValue('MC_NICK_MODE', minecraftConfig.nickMode);
        logger.add(`Режим ника изменён на ${minecraftConfig.nickMode}.`);
        await renderMenu(chatId, messageId, getNickSettingsMenu);
        break;

      case 'change_nickname':
        state.waitingForNickname = true;
        state.waitingForPassword = false;
        minecraftConfig.nickMode = 'STATIC';
        persistConfigValue('MC_NICK_MODE', 'STATIC');
        await sendEphemeralMessage(
          chatId,
          '👇 Отправьте новый ник следующим сообщением.',
          appConfig.telegram.notificationTtlMs
        );
        break;

      case 'change_host':
        resetWaitingState();
        state.waitingForHost = true;
        await sendEphemeralMessage(
          chatId,
          '👇 Отправьте адрес сервера. Можно с портом через двоеточие:\n' +
          '<code>play.example.com</code>\n' +
          '<code>StrixFlow.aternos.me:33168</code>',
          appConfig.telegram.notificationTtlMs
        );
        break;

      case 'change_port':
        resetWaitingState();
        state.waitingForPort = true;
        await sendEphemeralMessage(
          chatId,
          '👇 Отправьте порт сервера (1–65535).',
          appConfig.telegram.notificationTtlMs
        );
        break;

      case 'change_version':
        resetWaitingState();
        state.waitingForVersion = true;
        await sendEphemeralMessage(
          chatId,
          '👇 Отправьте версию (например <code>1.20.1</code>) или <code>auto</code> для автодетекта.',
          appConfig.telegram.notificationTtlMs
        );
        break;

      case 'show_logs':
        await sendEphemeralMessage(
          chatId,
          buildLogsText(logger.recent(12)),
          appConfig.telegram.logsTtlMs
        );
        break;

      default:
        logger.add(`Неизвестная callback-команда: ${query.data}`);
        break;
    }
  } catch (error) {
    const description = error?.response?.body?.description || '';
    if (!description.includes('message is not modified')) {
      logger.add(`Ошибка обработки кнопки: ${error.message}`);
    }
  } finally {
    bot.answerCallbackQuery(query.id).catch(() => {});
  }
});

async function shutdown(signal) {
  logger.add(`Получен ${signal}. Завершаю работу.`);
  try {
    minecraft.shutdown();
  } catch (error) {
    logger.add(`Ошибка остановки Minecraft: ${error.message}`);
  }
  try {
    await Promise.race([
      bot.stopPolling(),
      new Promise((resolve) => setTimeout(resolve, 5000))
    ]);
  } catch (_) {}
  process.exit(0);
}

process.once('SIGINT', () => { shutdown('SIGINT'); });
process.once('SIGTERM', () => { shutdown('SIGTERM'); });

logger.add('🚀 Бот запущен. Отправьте /menu в Telegram.');
