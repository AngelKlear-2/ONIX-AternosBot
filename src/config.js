require('dotenv').config();

const AUTH_MODES = ['FORCED', 'AUTO', 'OFF'];
const NICK_MODES = ['STATIC', 'RANDOM'];

function parseInteger(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function normalizeMode(value, allowedValues, fallbackValue) {
  const normalized = String(value || '').trim().toUpperCase();
  return allowedValues.includes(normalized) ? normalized : fallbackValue;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function loadConfig(env = process.env) {
  return {
    telegram: {
      token: String(env.TELEGRAM_TOKEN || '').trim(),
      adminChatId: String(env.ADMIN_CHAT_ID || '').trim(),
      adminUserId: String(env.ADMIN_USER_ID || '').trim(),
      allowedUpdates: ['message', 'callback_query'],
      notificationTtlMs: parseInteger(env.TG_NOTIFICATION_TTL_MS, 10000),
      logsTtlMs: parseInteger(env.TG_LOGS_TTL_MS, 30000)
    },
    minecraft: {
      host: String(env.MC_HOST || '').trim(),
      port: parseInteger(env.MC_PORT, 24730),
      username: String(env.MC_USERNAME || 'AFKBot').trim(),
      registerPassword: String(env.MC_REGISTER_PASS || '').trim(),
      authMode: normalizeMode(env.MC_AUTH_MODE, AUTH_MODES, 'FORCED'),
      nickMode: normalizeMode(env.MC_NICK_MODE, NICK_MODES, 'STATIC'),
      version: String(env.MC_VERSION || '').trim() || false,
      reconnectIntervalMs: parseInteger(env.MC_RECONNECT_INTERVAL_MS, 30000),
      slowRetryAfterAttempts: parseInteger(env.MC_SLOW_RETRY_AFTER, 5),
      slowRetryIntervalMs: parseInteger(env.MC_SLOW_RETRY_INTERVAL_MS, 300000),
      randomActionIntervalMs: parseInteger(env.MC_RANDOM_ACTION_INTERVAL_MS, 60000),
      statusIntervalMs: parseInteger(env.MC_STATUS_INTERVAL_MS, 3600000),
      avoidMobs: parseBoolean(env.MC_AVOID_MOBS, false),
      avoidCliffs: parseBoolean(env.MC_AVOID_CLIFFS, true),
      avoidWater: parseBoolean(env.MC_AVOID_WATER, true),
      verboseAfk: parseBoolean(env.MC_VERBOSE_AFK, false),
      detectionRadius: parseInteger(env.MC_DETECTION_RADIUS, 16),
      mobScanIntervalMs: parseInteger(env.MC_MOB_SCAN_INTERVAL_MS, 500),
      stuckTimeoutMs: parseInteger(env.MC_STUCK_TIMEOUT_MS, 10000),
      stuckScanIntervalMs: parseInteger(env.MC_STUCK_SCAN_INTERVAL_MS, 2000),
      pathfindTimeoutMs: parseInteger(env.MC_PATHFIND_TIMEOUT_MS, 1500),
      fleeDistance: parseInteger(env.MC_FLEE_DISTANCE, 16),
      smartAfk: parseBoolean(env.MC_SMART_AFK, true),
      combatEnabled: parseBoolean(env.MC_COMBAT_ENABLED, false)
    },
    logging: {
      maxLines: parseInteger(env.MAX_LOG_LINES, 80)
    }
  };
}

function validateProcessConfig(config) {
  const missingFields = [];

  if (!config.telegram.token) {
    missingFields.push('TELEGRAM_TOKEN');
  }

  if (!config.telegram.adminChatId) {
    missingFields.push('ADMIN_CHAT_ID');
  }

  return missingFields;
}

function validateMinecraftConfig(config) {
  const missingFields = [];

  if (!config.minecraft.host) {
    missingFields.push('MC_HOST (задайте через меню ⚙️ → 🖥 Сервер)');
  }

  return missingFields;
}

function validateConfig(config) {
  return [...validateProcessConfig(config), ...validateMinecraftConfig(config)];
}

module.exports = {
  AUTH_MODES,
  NICK_MODES,
  loadConfig,
  validateConfig,
  validateProcessConfig,
  validateMinecraftConfig
};
