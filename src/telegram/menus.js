const { escapeHtml, maskSecret } = require('../utils/html');

function formatStatus(status, extra = {}) {
  switch (status) {
    case 'online':
      return '🟢 Онлайн';
    case 'connecting':
      return '🟡 Подключение...';
    case 'reconnecting': {
      const attempt = extra.reconnectAttempt || '?';
      const phase = extra.reconnectPhase === 'slow' ? '🐢 медленный' : '⚡ быстрый';
      return `🟡 Переподключение #${attempt} (${phase})...`;
    }
    case 'error':
      return '🔴 Ошибка';
    case 'version_error':
      return '🔴 Версия не поддерживается';
    default:
      return '⚫ Оффлайн';
  }
}

const DIVIDER = '━━━━━━━━━━━━━━━';

function formatNick({ minecraft, activeUsername, status }) {
  const isLive = status === 'online' || status === 'connecting' || status === 'reconnecting';
  const staticNick = minecraft.username || 'AFKBot';

  if (minecraft.nickMode === 'RANDOM') {
    if (isLive && activeUsername) {
      return `🎲 случайный → <code>${escapeHtml(activeUsername)}</code>`;
    }
    return `🎲 случайный <i>(подберётся при подключении)</i>`;
  }

  return `<code>${escapeHtml(staticNick)}</code>`;
}

function formatAuthMode(mode) {
  switch (mode) {
    case 'FORCED': return 'FORCED <i>(всегда /register + /login)</i>';
    case 'AUTO': return 'AUTO <i>(реакция на запрос сервера)</i>';
    case 'OFF': return 'OFF <i>(без авторизации)</i>';
    default: return mode;
  }
}

function formatUptimeLine(uptimeInfo) {
  if (!uptimeInfo) return '';
  const { h, m, actionCount, lastActionMinutesAgo } = uptimeInfo;
  const since = `${h}ч ${m}м`;
  const last = lastActionMinutesAgo === null || lastActionMinutesAgo === undefined
    ? '—'
    : (lastActionMinutesAgo === 0 ? 'только что' : `${lastActionMinutesAgo} мин назад`);
  return `\n⏱ <b>Аптайм:</b> ${since}  |  🎯 AFK: ${actionCount}  |  посл.: ${last}`;
}

function buildMainMenu({ status, minecraft, activeUsername, reconnectAttempt, reconnectPhase, uptimeInfo }) {
  const host = minecraft.host ? `${minecraft.host}:${minecraft.port}` : 'не задан';
  const isOff = status === 'offline' || status === 'version_error';
  const connectButton = isOff
    ? { text: '▶️ Подключить', callback_data: 'cmd_start' }
    : { text: '⏹ Отключить', callback_data: 'cmd_stop' };

  const statusLine = formatStatus(status, { reconnectAttempt, reconnectPhase });
  const nickLine = formatNick({ minecraft, activeUsername, status });

  let errorHint = '';
  if (status === 'version_error') {
    errorHint = `\n\n⚠️ <i>Укажите корректную версию в MC_VERSION (.env)</i>`;
  }

  const uptimeLine = status === 'online' ? formatUptimeLine(uptimeInfo) : '';

  return {
    text:
      `🎮 <b>Minecraft AFK Bot</b>\n` +
      `${DIVIDER}\n\n` +
      `📡 <b>Статус:</b> ${statusLine}\n` +
      `🖥 <b>Сервер:</b> <code>${escapeHtml(host)}</code>\n` +
      `👤 <b>Ник:</b> ${nickLine}\n` +
      `🔐 <b>Авторизация:</b> <code>${escapeHtml(minecraft.authMode)}</code>` +
      uptimeLine +
      errorHint,
    markup: {
      inline_keyboard: [
        [connectButton],
        [{ text: '⚙️ Настройки', callback_data: 'open_settings' }],
        [{ text: '📋 Логи', callback_data: 'show_logs' }]
      ]
    }
  };
}

function formatBool(v) {
  return v ? '✅ вкл' : '❌ выкл';
}

function buildSettingsMenu({ minecraft, activeUsername }) {
  const host = minecraft.host || 'не задан';
  const port = minecraft.port || 25565;
  const version = minecraft.version ? minecraft.version : 'auto';
  const nickPreview = minecraft.nickMode === 'RANDOM'
    ? (activeUsername ? `🎲 → ${activeUsername}` : '🎲 случайный')
    : (minecraft.username || 'AFKBot');

  const behaviorParts = [];
  if (minecraft.avoidMobs) behaviorParts.push('мобы');
  if (minecraft.avoidCliffs) behaviorParts.push('обрывы');
  if (minecraft.avoidWater) behaviorParts.push('вода');
  const behaviorPreview = behaviorParts.length ? `избегает: ${behaviorParts.join(', ')}` : 'всё выключено';

  return {
    text:
      `⚙️ <b>Настройки</b>\n` +
      `${DIVIDER}\n\n` +
      `Выберите раздел:\n\n` +
      `🖥 <b>Сервер:</b> <code>${escapeHtml(host)}:${escapeHtml(String(port))}</code> <i>(${escapeHtml(String(version))})</i>\n` +
      `🔐 <b>Авторизация:</b> <code>${escapeHtml(minecraft.authMode)}</code>\n` +
      `👤 <b>Ник:</b> <code>${escapeHtml(nickPreview)}</code>\n` +
      `🛡 <b>Поведение:</b> <i>${escapeHtml(behaviorPreview)}</i>`,
    markup: {
      inline_keyboard: [
        [{ text: '🖥 Сервер', callback_data: 'open_server_settings' }],
        [{ text: '🔐 Авторизация', callback_data: 'open_auth_settings' }],
        [{ text: '👤 Ник', callback_data: 'open_nick_settings' }],
        [{ text: '🛡 Поведение', callback_data: 'open_behavior_settings' }],
        [{ text: '← Назад', callback_data: 'back_to_main' }]
      ]
    }
  };
}

function buildBehaviorSettingsMenu({ minecraft }) {
  return {
    text:
      `🛡 <b>Настройки · Поведение</b>\n` +
      `${DIVIDER}\n\n` +
      `<b>Избегать мобов:</b> ${formatBool(minecraft.avoidMobs)}\n` +
      `<i>Бот убегает спринтом + прыжком при враждебном мобе в радиусе 6 блоков.</i>\n\n` +
      `<b>Избегать обрывов:</b> ${formatBool(minecraft.avoidCliffs)}\n` +
      `<i>Бот не делает шаг туда, где под ногами нет блока.</i>\n\n` +
      `<b>Избегать воды:</b> ${formatBool(minecraft.avoidWater)}\n` +
      `<i>Бот не идёт в клетку с водой/лавой.</i>`,
    markup: {
      inline_keyboard: [
        [{ text: `🧟 Мобы: ${formatBool(minecraft.avoidMobs)}`, callback_data: 'toggle_avoid_mobs' }],
        [{ text: `⛰ Обрывы: ${formatBool(minecraft.avoidCliffs)}`, callback_data: 'toggle_avoid_cliffs' }],
        [{ text: `💧 Вода: ${formatBool(minecraft.avoidWater)}`, callback_data: 'toggle_avoid_water' }],
        [{ text: '← К настройкам', callback_data: 'back_to_settings' }]
      ]
    }
  };
}

function buildServerSettingsMenu({ minecraft }) {
  const host = minecraft.host || 'не задан';
  const port = minecraft.port || 25565;
  const version = minecraft.version ? minecraft.version : 'auto';

  return {
    text:
      `🖥 <b>Настройки · Сервер</b>\n` +
      `${DIVIDER}\n\n` +
      `<b>Адрес:</b> <code>${escapeHtml(host)}</code>\n` +
      `<b>Порт:</b> <code>${escapeHtml(String(port))}</code>\n` +
      `<b>Версия:</b> <code>${escapeHtml(String(version))}</code>\n\n` +
      `<i>Подсказка: при изменении адреса можно прислать </i><code>host:port</code><i> — порт подставится автоматически.</i>`,
    markup: {
      inline_keyboard: [
        [{ text: '🖥 Изменить адрес', callback_data: 'change_host' }],
        [{ text: '🔌 Изменить порт', callback_data: 'change_port' }],
        [{ text: '🏷 Изменить версию', callback_data: 'change_version' }],
        [{ text: '← К настройкам', callback_data: 'back_to_settings' }]
      ]
    }
  };
}

function buildAuthSettingsMenu({ minecraft }) {
  return {
    text:
      `🔐 <b>Настройки · Авторизация</b>\n` +
      `${DIVIDER}\n\n` +
      `<b>Режим:</b> ${formatAuthMode(minecraft.authMode)}\n` +
      `<b>Пароль:</b> <code>${escapeHtml(maskSecret(minecraft.registerPassword))}</code>`,
    markup: {
      inline_keyboard: [
        [{ text: `🔐 Режим: ${minecraft.authMode}`, callback_data: 'toggle_mode' }],
        [{ text: '🔑 Изменить пароль', callback_data: 'change_password' }],
        [{ text: '← К настройкам', callback_data: 'back_to_settings' }]
      ]
    }
  };
}

function buildNickSettingsMenu({ minecraft, activeUsername }) {
  const staticNick = minecraft.username || 'AFKBot';
  let randomHint = '';
  if (minecraft.nickMode === 'RANDOM' && activeUsername) {
    randomHint = `\n<b>Текущий случайный:</b> <code>${escapeHtml(activeUsername)}</code>`;
  }

  return {
    text:
      `👤 <b>Настройки · Ник</b>\n` +
      `${DIVIDER}\n\n` +
      `<b>Режим:</b> <code>${escapeHtml(minecraft.nickMode)}</code>\n` +
      `<b>Ник (STATIC):</b> <code>${escapeHtml(staticNick)}</code>` +
      randomHint,
    markup: {
      inline_keyboard: [
        [{ text: `🎲 Режим: ${minecraft.nickMode}`, callback_data: 'toggle_nick_mode' }],
        [{ text: '✏️ Задать свой ник', callback_data: 'change_nickname' }],
        [{ text: '← К настройкам', callback_data: 'back_to_settings' }]
      ]
    }
  };
}

function buildHelpText() {
  return (
    `ℹ️ <b>Команды</b>\n\n` +
    `/menu - открыть главное меню\n` +
    `/status - показать текущий статус\n` +
    `/help - показать эту справку\n\n` +
    `Основное управление ботом находится в inline-кнопках меню.`
  );
}

function buildLogsText(logLines) {
  if (!logLines.length) {
    return '📋 <b>Логи пока пусты.</b>';
  }

  return `📋 <b>Последние логи</b>\n\n<pre>${escapeHtml(logLines.join('\n'))}</pre>`;
}

module.exports = {
  buildHelpText,
  buildLogsText,
  buildMainMenu,
  buildSettingsMenu,
  buildServerSettingsMenu,
  buildAuthSettingsMenu,
  buildNickSettingsMenu,
  buildBehaviorSettingsMenu
};
