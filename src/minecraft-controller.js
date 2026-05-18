const mineflayer = require('mineflayer');
const pathfinderSetup = require('./ai/pathfinder-setup');
const ThreatPolicy = require('./ai/threat-policy');
const { StuckLadder } = require('./ai/stuck-recovery');
const { Combat } = require('./ai/combat');

const NICK_FIRST_NAMES = [
  'Andrew', 'Mike', 'Daniel', 'Anton', 'Max', 'Alex', 'Tom', 'Sam', 'Leo', 'Nick',
  'Ivan', 'Pavel', 'Igor', 'Sergey', 'Artem', 'Denis', 'Vlad', 'Kirill', 'Roman',
  'Egor', 'Ilya', 'Oleg', 'Yura', 'Kostya', 'Dima', 'Vova'
];

const NICK_PREFIXES = [
  'Pro', 'Ninja', 'Shadow', 'Dragon', 'Dark', 'Mighty', 'Crazy', 'Wild', 'Cyber',
  'Ice', 'Fire', 'Frost', 'Storm', 'Night', 'Lone', 'Silent', 'Phantom', 'Lucky',
  'Toxic', 'Savage', 'Epic', 'Royal'
];

const NICK_WORDS = [
  'Blade', 'Knight', 'Hunter', 'Ranger', 'Mage', 'Storm', 'Phantom', 'Reaper',
  'Slayer', 'Wolf', 'Dragon', 'Tiger', 'Eagle', 'Beast', 'Raven', 'Fox', 'Hawk',
  'Viper', 'Falcon', 'Demon', 'Spirit', 'Ghost', 'Warrior', 'Sniper', 'Crusher',
  'Striker', 'Rider', 'Walker'
];

const NICK_SUFFIXES = [
  'Master', 'Killer', 'Hunter', 'Lord', 'King', 'Slayer', 'Ace', 'God', 'Boss',
  'Pro', 'Czar', 'Chief'
];

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDigits(min, max) {
  const len = min + Math.floor(Math.random() * (max - min + 1));
  if (len <= 0) return '';
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += Math.floor(Math.random() * 10);
  }
  return out;
}

const AFK_ACTIONS = [
  { type: 'rotate', weight: 18 },
  { type: 'move', weight: 28 },
  { type: 'jump', weight: 10 },
  { type: 'sneak', weight: 8 },
  { type: 'move_sprint', weight: 18 },
  { type: 'combo_jump_move', weight: 10 },
  { type: 'look_around', weight: 8 }
];

const AFK_CONTROL_STATES = ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'];

const HOSTILE_MOB_NAMES = new Set([
  'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider', 'witch', 'enderman',
  'zombified_piglin', 'pillager', 'vindicator', 'evoker', 'ravager', 'phantom',
  'drowned', 'husk', 'stray', 'wither_skeleton', 'piglin', 'piglin_brute',
  'zoglin', 'hoglin', 'blaze', 'ghast', 'magma_cube', 'slime', 'silverfish',
  'endermite', 'guardian', 'elder_guardian', 'shulker', 'vex', 'warden',
  'wither', 'ender_dragon', 'illusioner'
]);

const DIRECTION_VECTORS = {
  forward: { x: 0, z: 1 },
  back: { x: 0, z: -1 },
  left: { x: -1, z: 0 },
  right: { x: 1, z: 0 }
};

const AIR_BLOCKS = new Set(['air', 'cave_air', 'void_air']);
const LAVA_BLOCKS = new Set(['lava', 'flowing_lava']);
const WATER_BLOCKS = new Set(['water', 'flowing_water']);
const SOFT_LANDING_BLOCKS = new Set([
  'water', 'flowing_water',
  'hay_block', 'slime_block', 'honey_block', 'cobweb',
  'sweet_berry_bush', 'powder_snow',
  'oak_leaves', 'spruce_leaves', 'birch_leaves', 'jungle_leaves',
  'acacia_leaves', 'dark_oak_leaves', 'mangrove_leaves', 'cherry_leaves',
  'azalea_leaves', 'flowering_azalea_leaves'
]);

function isUnsafeBlock(block, { avoidWater }) {
  if (!block) return false;
  const name = block.name || '';
  if (AIR_BLOCKS.has(name)) return true;
  if (LAVA_BLOCKS.has(name)) return true;
  if (avoidWater && WATER_BLOCKS.has(name)) return true;
  return false;
}

function isDangerousFallAt(bot, x, y, z, { avoidWater, maxSafeFall = 3, scanDepth = 24 }) {
  if (!bot || typeof bot.blockAt !== 'function') return false;
  const Vec3 = bot.entity && bot.entity.position && bot.entity.position.constructor;
  if (!Vec3) return false;

  for (let dy = 1; dy <= scanDepth; dy += 1) {
    let block;
    try {
      block = bot.blockAt(new Vec3(x, y - dy, z));
    } catch (_) {
      return false;
    }
    if (!block) return false;
    const name = block.name || '';

    if (LAVA_BLOCKS.has(name)) return true;
    if (AIR_BLOCKS.has(name)) continue;

    if (SOFT_LANDING_BLOCKS.has(name)) {
      if (WATER_BLOCKS.has(name) && avoidWater) {
        return false;
      }
      return false;
    }

    const fallBlocks = dy - 1;
    return fallBlocks > maxSafeFall;
  }

  return true;
}

function weightedPick(table) {
  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return table[table.length - 1].type;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function generateRandomNick() {
  const styles = [
    () => pickOne(NICK_FIRST_NAMES) + randomDigits(2, 3),
    () => pickOne(NICK_PREFIXES) + pickOne(NICK_WORDS),
    () => pickOne(NICK_PREFIXES) + pickOne(NICK_WORDS) + randomDigits(0, 2),
    () => pickOne(NICK_WORDS) + pickOne(NICK_SUFFIXES),
    () => pickOne(NICK_FIRST_NAMES),
    () => pickOne(NICK_FIRST_NAMES) + '_' + pickOne(NICK_WORDS),
    () => 'xX' + pickOne(NICK_WORDS) + 'Xx',
    () => pickOne(NICK_WORDS) + randomDigits(2, 4),
    () => pickOne(NICK_FIRST_NAMES) + pickOne(NICK_SUFFIXES),
    () => pickOne(NICK_PREFIXES) + '_' + pickOne(NICK_FIRST_NAMES)
  ];

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const nick = styles[Math.floor(Math.random() * styles.length)]();
    if (nick.length >= 4 && nick.length <= 16 && /^[A-Za-z0-9_]+$/.test(nick)) {
      return nick;
    }
  }

  return pickOne(NICK_FIRST_NAMES) + randomDigits(2, 3);
}

class MinecraftController {
  constructor({ config, logger, notifyAdmin, onStatusChange }) {
    this.config = config;
    this.logger = logger;
    this.notifyAdmin = notifyAdmin;
    this.onStatusChange = onStatusChange;

    this.bot = null;
    this.started = false;
    this.status = 'offline';
    this.activeUsername = config.username;
    this.reconnectAttempts = 0;
    this.lastAuthCommandAt = 0;
    this.authCooldownMs = 15000;
    this.randomActionTimer = null;
    this.statusTimer = null;
    this.reconnectTimer = null;
    this.stuckTimer = null;
    this.reconnecting = false;
    this.instanceId = 0;
    this.closing = false;
    this.lastMovePos = null;
    this.lastMoveAt = 0;
    this.consecutiveTrapped = 0;
    this.lastDeathAt = 0;
    this.deathCount = 0;
    this.deathWindowStart = 0;
    this.afkPausedUntil = 0;
    this.chatSeen = new Map();
    this.mobScanTimer = null;
    this.fleeingUntil = 0;
    this.fleeDir = null;
    this.fleeLastPos = null;
    this.fleeNoProgressTicks = 0;
    this.fleeStrafe = null;
    this.fleeStrafeUntil = 0;
    this.fleeLastYawUpdate = 0;
    this.keepaliveTimer = null;
    this.lastServerPacketAt = 0;
    this.duplicateCheckTimer = null;
    this.onlineSince = null;
    this.afkActionCount = 0;
    this.lastActionAt = null;
    this.forcedRegisterSent = false;
    this._versionWarnSent = false;

    this._pathfinderGoals = null;
    this._pathfinderAvailable = false;
    this._lastFleePlanAt = 0;
    this._lastFleeTargetId = null;
    this._failedDirections = new Map();
    this.waterSurvivalTimer = null;
    this._inWaterSince = 0;
    this._lastShoreTarget = null;
    this._lastShoreSearchAt = 0;
    this._combat = new Combat({ bot: null, logger: this.logger });
    this._stuckLadder = new StuckLadder({
      bot: null,
      logger: this.logger,
      controller: this,
      goals: {},
      runWithTimeout: pathfinderSetup.runWithTimeout
    });
  }

  _policyCtx() {
    return {
      logger: this.logger,
      notifyAdmin: this.notifyAdmin,
      runWithTimeout: pathfinderSetup.runWithTimeout,
      timeoutMs: this.config.pathfindTimeoutMs,
      fleeDistance: this.config.fleeDistance,
      isBlacklisted: (yaw) => this._isDirectionBlacklisted(yaw),
      recordFail: (yaw) => this._recordFailedDirection(yaw)
    };
  }

  _stuckCtx() {
    return {
      isDangerousFallAt,
      avoidWater: this.config.avoidWater
    };
  }

  _recordFailedDirection(yawRad) {
    if (typeof yawRad !== 'number' || Number.isNaN(yawRad)) return;
    const sector = ((Math.round((yawRad + Math.PI) / (Math.PI / 4)) % 8) + 8) % 8;
    this._failedDirections.set(sector, Date.now() + 30000);
  }

  _isDirectionBlacklisted(yawRad) {
    if (typeof yawRad !== 'number' || Number.isNaN(yawRad)) return false;
    const sector = ((Math.round((yawRad + Math.PI) / (Math.PI / 4)) % 8) + 8) % 8;
    const exp = this._failedDirections.get(sector);
    if (!exp) return false;
    if (Date.now() > exp) {
      this._failedDirections.delete(sector);
      return false;
    }
    return true;
  }

  _hostileNear(point, radius) {
    const bot = this.bot;
    if (!bot || !bot.entities) return false;
    for (const id of Object.keys(bot.entities)) {
      const e = bot.entities[id];
      if (!e || !e.position || !e.name) continue;
      if (!HOSTILE_MOB_NAMES.has(e.name)) continue;
      const dx = e.position.x - point.x;
      const dz = e.position.z - point.z;
      if (Math.sqrt(dx * dx + dz * dz) <= radius) return true;
    }
    return false;
  }

  setStatus(nextStatus) {
    this.status = nextStatus;
    if (typeof this.onStatusChange === 'function') {
      this.onStatusChange(nextStatus);
    }
  }

  _afkLog(message) {
    if (this.config.verboseAfk) {
      this.logger.add(message);
    }
  }

  async _afkWander({ sprint = false } = {}) {
    const bot = this.bot;
    if (!bot || !bot.entity || !bot.pathfinder || !this._pathfinderGoals.GoalNear) return;
    const me = bot.entity.position;
    const Vec3 = me.constructor;

    for (let i = 0; i < 6; i += 1) {
      const dx = Math.floor(randomBetween(-15, 15));
      const dz = Math.floor(randomBetween(-15, 15));
      if (Math.hypot(dx, dz) < 5) continue;
      const target = new Vec3(Math.floor(me.x) + dx, Math.floor(me.y), Math.floor(me.z) + dz);

      if (this._hostileNear(target, 8)) continue;
      if (this.config.avoidCliffs && isDangerousFallAt(bot, target.x, target.y, target.z, {
        avoidWater: this.config.avoidWater, maxSafeFall: 3, scanDepth: 24
      })) continue;
      if (this.config.avoidWater) {
        try {
          const tb = bot.blockAt(target);
          if (tb && WATER_BLOCKS.has(tb.name || '')) continue;
          const gb = bot.blockAt(new Vec3(target.x, target.y - 1, target.z));
          if (gb && WATER_BLOCKS.has(gb.name || '')) continue;
        } catch (_) {}
      }

      const goal = new this._pathfinderGoals.GoalNear(target.x, target.y, target.z, 1);
      this._afkLog(`AFK pathfind → (${target.x}, ${target.z})${sprint ? ' (sprint)' : ''}`);
      const r = await pathfinderSetup.runWithTimeout(bot, goal, 4000);
      if (r.ok || r.reason === 'cancelled') return;
    }
    this._afkLog('AFK pathfind: все 6 кандидатов отклонены — пропуск действия.');
  }

  getCurrentUsername() {
    if (this.config.nickMode === 'RANDOM') {
      return generateRandomNick();
    }

    return this.config.username || 'AFKBot';
  }

  start() {
    if (this.started) {
      return false;
    }

    if (this.closing) {
      this.notifyAdmin('⏳ Подождите ~5 сек, предыдущее соединение ещё закрывается.');
      return false;
    }

    if (!this.config.host) {
      this.notifyAdmin('⚠️ Не указан MC_HOST. Заполните .env перед запуском.', { persistent: true });
      return false;
    }

    this.started = true;
    this.reconnectAttempts = 0;
    this.status = 'offline';
    this.connect();
    return true;
  }

  stop(reason = 'Отключен администратором', notify = true) {
    if (!this.started && !this.bot) {
      this.setStatus('offline');
      return false;
    }

    this.started = false;
    this.reconnecting = false;
    this.instanceId += 1;
    this.clearReconnectTimer();
    this.clearRandomActionTimer();
    this.clearStatusTimer();
    this.clearStuckTimer();
    this.clearMobScanTimer();
    this.clearKeepaliveTimer();
    this.clearWaterSurvivalTimer();
    if (this.duplicateCheckTimer) {
      clearTimeout(this.duplicateCheckTimer);
      this.duplicateCheckTimer = null;
    }
    try {
      if (this.bot && this.bot.pathfinder && typeof this.bot.pathfinder.stop === 'function') {
        this.bot.pathfinder.stop();
      }
    } catch (_) {}
    this._stuckLadder.reset();
    this.clearControlStates();

    const activeBot = this.bot;
    this.bot = null;

    if (this.status !== 'version_error') {
      this.setStatus('offline');
    }

    this.onlineSince = null;
    this.lastActionAt = null;

    this.logger.add(`Бот остановлен: ${reason}`);

    if (notify) {
      this.notifyAdmin('🛑 Бот отключён.');
    }

    if (activeBot) {
      this.closing = true;
      const client = activeBot._client;
      const socket = client && client.socket;

      let finalized = false;
      const finalize = () => {
        if (finalized) return;
        finalized = true;
        this.closing = false;
      };

      if (socket && typeof socket.once === 'function') {
        socket.once('close', finalize);
        socket.once('error', finalize);
      }
      const hardTimeout = setTimeout(finalize, 5000);

      try {
        if (typeof activeBot.quit === 'function') {
          activeBot.quit(reason);
        }
      } catch (error) {
        this.logger.add(`Ошибка quit(): ${error.message}`);
      }

      try {
        activeBot.removeAllListeners();
      } catch (_) {}

      try {
        if (client && typeof client.end === 'function') {
          client.end();
        }
      } catch (_) {}

      setTimeout(() => {
        try {
          if (socket && !socket.destroyed) {
            socket.destroy();
          }
        } catch (_) {}
        clearTimeout(hardTimeout);
        finalize();
      }, 2000);
    }

    return true;
  }

  _reconnectDelay() {
    if (this.reconnectAttempts < this.config.slowRetryAfterAttempts) {
      return this.config.reconnectIntervalMs;
    }
    return this.config.slowRetryIntervalMs;
  }

  _reconnectPhaseLabel() {
    const n = this.reconnectAttempts + 1;
    if (this.reconnectAttempts < this.config.slowRetryAfterAttempts) {
      return `быстрая попытка ${n}/${this.config.slowRetryAfterAttempts}`;
    }
    const minutes = Math.round(this.config.slowRetryIntervalMs / 60000);
    return `медленный режим (попытка ${n}, каждые ${minutes} мин)`;
  }

  _scheduleReconnect(myInstanceId) {
    this.clearReconnectTimer();
    if (!this.started || myInstanceId !== this.instanceId) return;

    const delay = this._reconnectDelay();
    this.reconnecting = true;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnecting = false;

      if (!this.started || myInstanceId !== this.instanceId) {
        return;
      }

      this.reconnectAttempts += 1;

      if (this.reconnectAttempts === this.config.slowRetryAfterAttempts + 1) {
        const minutes = Math.round(this.config.slowRetryIntervalMs / 60000);
        this.notifyAdmin(
          `⚠️ Сервер не отвечает. Переключаюсь на медленный режим (раз в ${minutes} мин). Бот продолжит попытки бесконечно.`,
          { persistent: true }
        );
      }

      this.setStatus('reconnecting');
      this.logger.add(`Переподключение: ${this._reconnectPhaseLabel()}`);
      this.connect();
    }, delay);
  }

  connect() {
    if (!this.started) {
      return;
    }

    this.instanceId += 1;
    this.activeUsername = this.getCurrentUsername();
    this.setStatus('connecting');
    this.logger.add(`Подключение к ${this.config.host}:${this.config.port} под ником ${this.activeUsername}...`);

    const botOptions = {
      host: this.config.host,
      port: this.config.port,
      username: this.activeUsername,
      version: this.config.version || false
    };

    const bot = mineflayer.createBot(botOptions);
    this.bot = bot;
    this.attachBotEvents(bot);
  }

  attachBotEvents(bot) {
    bot.once('login', () => {
      this.handleLogin(bot);
    });

    bot.once('spawn', () => {
      this.handleSpawn(bot);
    });

    bot.on('message', (message) => {
      this.lastServerPacketAt = Date.now();
      this.handleMinecraftMessage(bot, message);
    });

    bot.on('end', (reason) => {
      this.handleDisconnect(bot, reason);
    });

    bot.on('error', (error) => {
      this.handleError(bot, error);
    });

    bot.on('death', () => {
      this.handleDeath(bot);
    });

    bot.on('players', (players) => {
      this.lastServerPacketAt = Date.now();
      if (this.duplicateCheckTimer) {
        clearTimeout(this.duplicateCheckTimer);
      }
      this.duplicateCheckTimer = setTimeout(() => {
        this.duplicateCheckTimer = null;
        this.handlePlayers(bot, players);
      }, 500);
    });

    bot.on('time', () => { this.lastServerPacketAt = Date.now(); });
    bot.on('health', () => { this.lastServerPacketAt = Date.now(); });
    bot.on('move', () => { this.lastServerPacketAt = Date.now(); });

    this.attachAutoJump(bot);

    const pf = pathfinderSetup.attach(bot, { logger: this.logger });
    this._pathfinderAvailable = pf.ok;
    this._pathfinderGoals = pf.goals;
    this._stuckLadder.setBot(bot);
    this._stuckLadder.goals = pf.goals;
    this._combat.setBot(bot);
  }

  handleLogin(bot) {
    if (bot !== this.bot) {
      return;
    }

    this.reconnectAttempts = 0;
    this.onlineSince = Date.now();
    this.afkActionCount = 0;
    this.lastActionAt = null;
    this.forcedRegisterSent = false;
    this._versionWarnSent = false;
    this.setStatus('online');
    this.logger.add('Бот успешно зашёл на сервер.');
    this.notifyAdmin('🟢 Бот успешно подключён.');

    if (this.config.authMode === 'FORCED') {
      const myInstanceId = this.instanceId;
      setTimeout(() => {
        if (bot !== this.bot || myInstanceId !== this.instanceId) return;
        this.forcedRegisterSent = true;
        this.sendAuthCommands('FORCED');
      }, 1500);
    }
  }

  getUptimeInfo() {
    if (!this.onlineSince) return null;
    const sec = Math.floor((Date.now() - this.onlineSince) / 1000);
    return {
      h: Math.floor(sec / 3600),
      m: Math.floor((sec % 3600) / 60),
      actionCount: this.afkActionCount,
      lastActionMinutesAgo: this.lastActionAt
        ? Math.floor((Date.now() - this.lastActionAt) / 60000)
        : null
    };
  }

  handleSpawn(bot) {
    if (bot !== this.bot) {
      return;
    }

    try {
      bot.physicsEnabled = true;
    } catch (_) {}

    try {
      if (bot.settings && typeof bot.settings.viewDistance !== 'undefined') {
        bot.settings.viewDistance = 'normal';
      }
    } catch (_) {}

    this.logger.add('Бот появился в мире. Жду прогрузки чанков…');

    const myInstanceId = this.instanceId;
    setTimeout(() => {
      if (bot !== this.bot || myInstanceId !== this.instanceId) return;
      this.logger.add('Чанки прогружены — физика и коллизии активны.');

      const p = bot.entity && bot.entity.position;
      if (p && (Number.isNaN(p.x) || Number.isNaN(p.z))) {
        const msg = 'Позиция бота NaN — mineflayer не распарсил пакет от сервера. ' +
                    'Скорее всего несовместимость с версией сервера. ' +
                    'Решение: в .env укажите MC_VERSION=1.21.4 (или другую стабильную).';
        this.logger.add('🚨 ' + msg);
        this.notifyAdmin('🚨 ' + msg, { persistent: true });
      }

      this.lastMovePos = p ? p.clone() : null;
      this.lastMoveAt = Date.now();
      this.lastServerPacketAt = Date.now();
      this.startRandomActions();
      this.ensureStatusTimer();
      this.ensureStuckTimer();
      this.ensureMobScanTimer();
      this.ensureKeepaliveTimer();
      this.ensureWaterSurvivalTimer();
      if (this.config.combatEnabled) {
        this._combat.equipBestArmor().catch(() => {});
      }
    }, 2500);
  }

  ensureKeepaliveTimer() {
    this.clearKeepaliveTimer();
    this.keepaliveTimer = setInterval(() => {
      if (!this.bot || this.status !== 'online') return;
      const entity = this.bot.entity;
      if (!entity || !entity.position) {
        this.logger.add('⚠️ Keepalive: entity недоступен — silent disconnect, переподключаюсь.');
        this.notifyAdmin('⚠️ Silent disconnect (нет entity). Переподключение...', { persistent: true });
        const lostBot = this.bot;
        this.handleDisconnect(lostBot, 'keepalive_no_entity');
        return;
      }
      const since = this.lastServerPacketAt ? Date.now() - this.lastServerPacketAt : 0;
      if (this.lastServerPacketAt && since > 90000) {
        this.logger.add(`⚠️ Keepalive: пакетов от сервера не было ${Math.round(since/1000)}с — переподключаюсь.`);
        this.notifyAdmin('⚠️ Silent disconnect (сервер молчит >90с). Переподключение...', { persistent: true });
        const lostBot = this.bot;
        this.handleDisconnect(lostBot, 'keepalive_packet_timeout');
      }
    }, 60000);
  }

  clearKeepaliveTimer() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  ensureWaterSurvivalTimer() {
    this.clearWaterSurvivalTimer();
    this.waterSurvivalTimer = setInterval(() => {
      if (!this.bot || this.status !== 'online') return;
      if (Date.now() < this.afkPausedUntil) return;
      const bot = this.bot;
      const entity = bot.entity;
      if (!entity) return;

      const inWater = entity.isInWater === true;

      if (inWater) {
        if (!this._inWaterSince) {
          this._inWaterSince = Date.now();
          this.logger.add('💧 Бот в воде — включаю режим выживания (jump + плыву к берегу).');
        }
        this._handleWaterSurvival();
      } else if (this._inWaterSince) {
        this.logger.add(`💧 Выбрался из воды за ${Math.round((Date.now() - this._inWaterSince) / 1000)}с.`);
        this._inWaterSince = 0;
        this._lastShoreTarget = null;
        try {
          bot.setControlState('jump', false);
          bot.setControlState('forward', false);
          bot.setControlState('sprint', false);
        } catch (_) {}
      }
    }, 250);
  }

  clearWaterSurvivalTimer() {
    if (this.waterSurvivalTimer) {
      clearInterval(this.waterSurvivalTimer);
      this.waterSurvivalTimer = null;
    }
    this._inWaterSince = 0;
    this._lastShoreTarget = null;
  }

  _handleWaterSurvival() {
    const bot = this.bot;
    if (!bot || !bot.entity) return;

    try {
      if (bot.pathfinder && typeof bot.pathfinder.isMoving === 'function' && bot.pathfinder.isMoving()) {
        bot.pathfinder.stop();
      }
    } catch (_) {}

    try { bot.setControlState('jump', true); } catch (_) {}

    const now = Date.now();
    let shore = this._lastShoreTarget;
    if (!shore || now - this._lastShoreSearchAt > 1500) {
      shore = this._findNearestShore(20);
      this._lastShoreTarget = shore;
      this._lastShoreSearchAt = now;
      if (shore) {
        this.logger.add(`💧 Курс на берег: (${shore.x}, ${shore.y}, ${shore.z}).`);
      }
    }

    if (!shore) {
      try {
        bot.setControlState('forward', true);
        bot.setControlState('sprint', true);
      } catch (_) {}
      return;
    }

    const dx = shore.x + 0.5 - bot.entity.position.x;
    const dz = shore.z + 0.5 - bot.entity.position.z;
    const yaw = Math.atan2(-dx, dz);
    try {
      bot.look(yaw, 0.1, false);
      bot.setControlState('forward', true);
      bot.setControlState('sprint', true);
    } catch (_) {}

    const dist = Math.hypot(dx, dz);
    if (dist < 2) {
      try { bot.setControlState('sprint', false); } catch (_) {}
    }
  }

  _findNearestShore(radius = 16) {
    const bot = this.bot;
    if (!bot || !bot.entity) return null;
    const me = bot.entity.position;
    const Vec3 = me.constructor;
    let best = null;
    let bestDist = Infinity;

    for (let r = 2; r <= radius; r += 1) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const x = Math.floor(me.x + Math.cos(a) * r);
        const z = Math.floor(me.z + Math.sin(a) * r);
        for (let dy = -2; dy <= 2; dy += 1) {
          const y = Math.floor(me.y) + dy;
          let ground, above;
          try {
            ground = bot.blockAt(new Vec3(x, y, z));
            above = bot.blockAt(new Vec3(x, y + 1, z));
          } catch (_) { continue; }
          if (!ground || !above) continue;

          const gname = ground.name || '';
          const aname = above.name || '';

          const isSolid = ground.boundingBox === 'block'
            && gname !== 'water' && gname !== 'flowing_water'
            && gname !== 'lava' && gname !== 'flowing_lava';
          const isClear = aname === 'air' || aname === 'cave_air' || aname === 'void_air';

          if (isSolid && isClear) {
            const dist = Math.hypot(x - me.x, z - me.z);
            if (dist < bestDist) {
              bestDist = dist;
              best = { x, y, z };
            }
            break;
          }
        }
      }
      if (best) return best;
    }
    return best;
  }

  ensureMobScanTimer() {
    this.clearMobScanTimer();
    if (!this.config.avoidMobs) return;
    this.mobScanTimer = setInterval(() => {
      if (!this.bot || this.status !== 'online') return;
      if (Date.now() < this.afkPausedUntil) return;
      const hostile = this.findNearestHostile(this.config.detectionRadius);
      if (hostile) {
        const policy = ThreatPolicy.forMob(hostile.name);
        const dist = this.bot.entity.position.distanceTo(hostile.position);
        if (dist <= (policy.critical || 8)) {
          this.fleeFromHostile(hostile).catch((e) => {
            this.logger.add(`Flee ошибка: ${e.message}`);
          });
        }
      } else if (Date.now() > this.fleeingUntil && (this.fleeDir || (this.bot.pathfinder && this.bot.pathfinder.isMoving()))) {
        this.releaseFleeControls();
      }
    }, this.config.mobScanIntervalMs);
  }

  clearMobScanTimer() {
    if (this.mobScanTimer) {
      clearInterval(this.mobScanTimer);
      this.mobScanTimer = null;
    }
  }

  releaseFleeControls() {
    const bot = this.bot;
    if (!bot) return;
    try {
      if (bot.pathfinder && typeof bot.pathfinder.stop === 'function') bot.pathfinder.stop();
    } catch (_) {}
    try {
      bot.setControlState('sprint', false);
      bot.setControlState('forward', false);
      bot.setControlState('left', false);
      bot.setControlState('right', false);
      bot.setControlState('jump', false);
      bot.setControlState('sneak', false);
    } catch (_) {}
    this.fleeDir = null;
    this.fleeingUntil = 0;
    this.fleeLastPos = null;
    this.fleeNoProgressTicks = 0;
    this.fleeYawBias = 0;
  }

  ensureStuckTimer() {
    this.clearStuckTimer();
    this.stuckTimer = setInterval(() => {
      if (!this.bot || this.status !== 'online') return;
      const now = Date.now();
      if (now < this.afkPausedUntil) {
        this.lastMoveAt = now;
        return;
      }
      if (this._inWaterSince) {
        this.lastMoveAt = now;
        return;
      }
      const pos = this.bot.entity && this.bot.entity.position;
      if (!pos) return;
      if (!this.lastMovePos) {
        this.lastMovePos = pos.clone();
        this.lastMoveAt = now;
        return;
      }
      const moved = pos.distanceTo(this.lastMovePos) > 0.5;
      if (moved) {
        if (pos.distanceTo(this.lastMovePos) > 2) {
          this._stuckLadder.reset();
        }
        this.lastMovePos = pos.clone();
        this.lastMoveAt = now;
        return;
      }
      if (this.deathCount >= 3 && (now - this.deathWindowStart) < 60000) return;
      if (now - this.lastMoveAt > this.config.stuckTimeoutMs) {
        try { this.bot.physicsEnabled = true; } catch (_) {}
        this._stuckLadder.trigger('idle').catch((e) => {
          this.logger.add(`StuckLadder ошибка: ${e.message}`);
        });
        this.lastMoveAt = now;
      }
    }, this.config.stuckScanIntervalMs);
  }

  clearStuckTimer() {
    if (this.stuckTimer) {
      clearInterval(this.stuckTimer);
      this.stuckTimer = null;
    }
  }

  forceEscape() {
    const bot = this.bot;
    if (!bot) return;
    const myInstanceId = this.instanceId;
    const dir = pickOne(['forward', 'back', 'left', 'right']);
    const startPos = bot.entity && bot.entity.position ? bot.entity.position.clone() : null;
    try {
      bot.setControlState('jump', true);
      bot.setControlState('sprint', true);
      bot.setControlState(dir, true);
      this.logger.add(`Escape: jump+sprint+${dir}`);
    } catch (_) {}
    setTimeout(() => {
      if (bot !== this.bot || myInstanceId !== this.instanceId) return;
      try {
        bot.setControlState('jump', false);
        bot.setControlState('sprint', false);
        bot.setControlState(dir, false);
      } catch (_) {}
      const endPos = bot.entity && bot.entity.position ? bot.entity.position : null;
      if (startPos && endPos) {
        const d = endPos.distanceTo(startPos);
        this.logger.add(`Escape result: Δ=${d.toFixed(3)} блоков за 2.5с`);
        if (d < 0.1) {
          this.logger.add('🚨 Сервер игнорирует движение бота (анти-чит/freeze/AuthMe). Проверьте чат и /login.');
        }
      }
    }, 2500);
  }

  isCliffInDirection(direction) {
    try {
      const bot = this.bot;
      if (!bot || !bot.entity || !bot.entity.position) return false;
      const dv = DIRECTION_VECTORS[direction];
      if (!dv) return false;
      const pos = bot.entity.position;
      const ahead = pos.offset(dv.x, 0, dv.z).floored();
      return isDangerousFallAt(bot, ahead.x, ahead.y, ahead.z, {
        avoidWater: this.config.avoidWater,
        maxSafeFall: 3,
        scanDepth: 24
      });
    } catch (_) {
      return false;
    }
  }

  isWaterAhead(direction) {
    try {
      const bot = this.bot;
      if (!bot || !bot.entity || !bot.entity.position) return false;
      const dv = DIRECTION_VECTORS[direction];
      if (!dv) return false;
      const pos = bot.entity.position;
      const ahead = pos.offset(dv.x, 0, dv.z).floored();
      const block = bot.blockAt(ahead);
      if (!block) return false;
      const name = block.name || '';
      return name === 'water' || name === 'flowing_water';
    } catch (_) {
      return false;
    }
  }

  findNearestHostile(radius = 6) {
    try {
      const bot = this.bot;
      if (!bot || !bot.entities || !bot.entity) return null;
      const myPos = bot.entity.position;
      let closest = null;
      let closestDist = Infinity;
      for (const id of Object.keys(bot.entities)) {
        const e = bot.entities[id];
        if (!e || !e.position || !e.name) continue;
        if (!HOSTILE_MOB_NAMES.has(e.name)) continue;
        const d = myPos.distanceTo(e.position);
        if (d < closestDist && d <= radius) {
          closest = e;
          closestDist = d;
        }
      }
      return closest;
    } catch (_) {
      return null;
    }
  }

  async fleeFromHostile(hostile) {
    const bot = this.bot;
    if (!bot || !bot.entity || !hostile || !hostile.position) return;

    if (this._inWaterSince) return;

    const now = Date.now();
    if (this._lastFleeTargetId === hostile.id && now - this._lastFleePlanAt < 700) return;
    this._lastFleePlanAt = now;
    this._lastFleeTargetId = hostile.id;
    this.fleeingUntil = now + 2500;
    this.fleeDir = 'pathfinder';

    if (this.config.combatEnabled && this._combat.shouldEngage(hostile)) {
      const r = await this._combat.attack(hostile);
      if (r.ok) return;
    }

    if (!this._pathfinderAvailable || !bot.pathfinder) {
      return this._legacyFlee(hostile);
    }

    const policy = ThreatPolicy.forMob(hostile.name);
    const dist = bot.entity.position.distanceTo(hostile.position);
    this.logger.add(`⚠️ ${hostile.name} d=${dist.toFixed(1)} → стратегия ${policy.fn.name}`);

    try {
      const result = await policy.fn(bot, hostile, this._policyCtx(), this._pathfinderGoals);
      if (!result || !result.ok) {
        this.logger.add(`Стратегия ${policy.fn.name} не сработала (${result && result.reason}). Эскалация stuck-ladder.`);
        this._stuckLadder.trigger('flee_failed').catch(() => {});
      }
    } catch (error) {
      this.logger.add(`Flee исключение: ${error.message}`);
    }
  }

  _legacyFlee(hostile) {
    const bot = this.bot;
    if (!bot || !bot.entity) return;
    const my = bot.entity.position;
    const dx = my.x - hostile.position.x;
    const dz = my.z - hostile.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    const yawAwayFromMob = Math.atan2(-(dx / dist), -(dz / dist));
    try {
      bot.look(yawAwayFromMob, 0, true);
      bot.setControlState('sprint', true);
      bot.setControlState('forward', true);
    } catch (_) {}
    setTimeout(() => {
      if (bot !== this.bot) return;
      try {
        bot.setControlState('sprint', false);
        bot.setControlState('forward', false);
      } catch (_) {}
    }, 1200);
  }

  pickSafeDirection(candidates, { allowFallback = true } = {}) {
    const safe = [];
    for (const dir of candidates) {
      if (this.config.avoidCliffs && this.isCliffInDirection(dir)) continue;
      if (this.config.avoidWater && this.isWaterAhead(dir)) continue;
      safe.push(dir);
    }
    if (safe.length > 0) return pickOne(safe);
    if (!allowFallback) return null;

    const survivable = candidates.filter((dir) => !this.isLavaInDirection(dir));
    if (survivable.length > 0) {
      return pickOne(survivable);
    }
    return null;
  }

  yawForDirection(dir) {
    const dv = DIRECTION_VECTORS[dir];
    if (!dv) return 0;
    return Math.atan2(-dv.x, dv.z);
  }

  async faceDirection(dir) {
    try {
      const bot = this.bot;
      if (!bot) return;
      const yaw = this.yawForDirection(dir);
      const jitter = (Math.random() - 0.5) * (Math.PI / 36);
      const pitch = (Math.random() - 0.5) * 0.3;
      await bot.look(yaw + jitter, pitch, true);
    } catch (_) {}
  }

  scheduleHeadWobble(durationMs) {
    const bot = this.bot;
    if (!bot) return;
    const myInstanceId = this.instanceId;
    const wobbles = Math.floor(durationMs / 350);
    let baseYaw;
    try { baseYaw = bot.entity.yaw; } catch (_) { return; }
    for (let i = 1; i <= wobbles; i += 1) {
      const at = i * 350 + Math.floor(Math.random() * 100);
      setTimeout(() => {
        if (bot !== this.bot || myInstanceId !== this.instanceId) return;
        try {
          const dy = (Math.random() - 0.5) * (Math.PI / 18);
          const dp = (Math.random() - 0.5) * 0.25;
          bot.look(baseYaw + dy, dp, false);
        } catch (_) {}
      }, at);
    }
  }

  forwardVector() {
    const bot = this.bot;
    if (!bot || !bot.entity) return null;
    const yaw = bot.entity.yaw || 0;
    return { dx: -Math.sin(yaw), dz: Math.cos(yaw) };
  }

  obstacleAhead() {
    try {
      const bot = this.bot;
      if (!bot || !bot.entity || !bot.entity.position) return 'clear';
      const fwd = this.forwardVector();
      if (!fwd) return 'clear';
      const pos = bot.entity.position;
      const Vec3 = pos.constructor;
      const probeDist = 0.55;
      const fx = Math.floor(pos.x + fwd.dx * probeDist);
      const fz = Math.floor(pos.z + fwd.dz * probeDist);
      const fy = Math.floor(pos.y);

      const foot = bot.blockAt(new Vec3(fx, fy, fz));
      const head = bot.blockAt(new Vec3(fx, fy + 1, fz));
      const above = bot.blockAt(new Vec3(fx, fy + 2, fz));

      const isSolid = (b) => {
        if (!b) return false;
        const n = b.name || '';
        if (AIR_BLOCKS.has(n)) return false;
        if (WATER_BLOCKS.has(n) || LAVA_BLOCKS.has(n)) return false;
        return b.boundingBox !== 'empty';
      };

      if (!isSolid(foot)) return 'clear';
      if (!isSolid(head) && !isSolid(above)) return 'step_up';
      return 'wall';
    } catch (_) {
      return 'clear';
    }
  }

  attachAutoJump(bot) {
    let lastJumpAt = 0;
    bot.on('physicsTick', () => {
      if (bot !== this.bot) return;
      if (bot.pathfinder && typeof bot.pathfinder.isMoving === 'function' && bot.pathfinder.isMoving()) return;
      const now = Date.now();
      if (now - lastJumpAt < 450) return;
      const state = bot.controlState || {};
      if (!state.forward) return;
      const ahead = this.obstacleAhead();
      if (ahead === 'step_up') {
        try {
          bot.setControlState('jump', true);
          lastJumpAt = now;
          setTimeout(() => {
            if (bot !== this.bot) return;
            try { bot.setControlState('jump', false); } catch (_) {}
          }, 220);
        } catch (_) {}
      }
    });
  }

  isStandingOnSolid() {
    try {
      const bot = this.bot;
      if (!bot || !bot.entity || !bot.entity.position) return true;
      if (bot.entity.onGround === true) return true;
      const pos = bot.entity.position;
      const Vec3 = pos.constructor;
      const below = new Vec3(Math.floor(pos.x), Math.floor(pos.y - 0.1), Math.floor(pos.z));
      const block = bot.blockAt(below);
      if (!block) return true;
      const name = block.name || '';
      if (AIR_BLOCKS.has(name)) return false;
      if (WATER_BLOCKS.has(name) || LAVA_BLOCKS.has(name)) return false;
      return true;
    } catch (_) {
      return true;
    }
  }

  isLavaInDirection(direction) {
    try {
      const bot = this.bot;
      if (!bot || !bot.entity || !bot.entity.position) return false;
      const dv = DIRECTION_VECTORS[direction];
      if (!dv) return false;
      const pos = bot.entity.position;
      const Vec3 = pos.constructor;
      for (let dy = 0; dy <= 8; dy += 1) {
        const block = bot.blockAt(new Vec3(
          Math.floor(pos.x + dv.x),
          Math.floor(pos.y - dy),
          Math.floor(pos.z + dv.z)
        ));
        if (!block) continue;
        if (LAVA_BLOCKS.has(block.name || '')) return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  handleMinecraftMessage(bot, message) {
    if (bot !== this.bot) {
      return;
    }

    const raw = message.toString();
    const text = raw.toLowerCase();

    if (raw && raw.trim().length > 0) {
      const now = Date.now();
      const lastSeen = this.chatSeen.get(raw) || 0;
      if (now - lastSeen > 10000) {
        this.chatSeen.set(raw, now);
        const trimmed = raw.replace(/\s+/g, ' ').slice(0, 200);
        this.logger.add(`[чат] ${trimmed}`);
      }
      if (this.chatSeen.size > 200) {
        const oldest = Array.from(this.chatSeen.entries()).sort((a, b) => a[1] - b[1])[0];
        if (oldest) this.chatSeen.delete(oldest[0]);
      }
    }

    if (this.config.authMode === 'FORCED' && this.forcedRegisterSent) {
      const alreadyRegisteredPatterns = [
        'already registered',
        'уже зарегистрирован',
        'alreadyregistered',
        'name is already',
        'name already'
      ];
      if (alreadyRegisteredPatterns.some((p) => text.includes(p))) {
        this.logger.add('FORCED auth: аккаунт уже существует — шлю только /login.');
        this.forcedRegisterSent = false;
        if (Date.now() - this.lastAuthCommandAt > 800) {
          this.sendAuthCommands('LOGIN_ONLY');
        }
        return;
      }
    }

    if (this.config.authMode !== 'AUTO') {
      return;
    }

    const triggers = [
      '/register',
      '/login',
      'register',
      'login',
      'зарегистрируйтесь',
      'авторизуйтесь',
      'пароль'
    ];

    if (!triggers.some((trigger) => text.includes(trigger))) {
      return;
    }

    if (Date.now() - this.lastAuthCommandAt < this.authCooldownMs) {
      return;
    }

    if (text.includes('/login')) {
      this.sendAuthCommands('LOGIN_ONLY');
      return;
    }

    if (text.includes('/register')) {
      this.sendAuthCommands('REGISTER_ONLY');
      return;
    }

    this.sendAuthCommands('AUTO');
  }

  sendAuthCommands(mode) {
    if (!this.bot) {
      return;
    }

    const password = this.config.registerPassword;

    if (!password) {
      this.logger.add('Пропуск auth-команд: MC_REGISTER_PASS не задан.');
      return;
    }

    try {
      this.lastAuthCommandAt = Date.now();
      if (mode === 'LOGIN_ONLY') {
        this.bot.chat(`/login ${password}`);
        this.logger.add('Отправлена команда /login.');
        return;
      }

      if (mode === 'REGISTER_ONLY') {
        this.bot.chat(`/register ${password} ${password}`);
        this.logger.add('Отправлена команда /register.');
        return;
      }

      this.bot.chat(`/register ${password} ${password}`);
      setTimeout(() => {
        if (this.bot) {
          this.bot.chat(`/login ${password}`);
        }
      }, 800);

      this.logger.add(
        mode === 'FORCED'
          ? 'Отправлены /register и /login (FORCED).'
          : 'Отправлены /register и /login (AUTO).'
      );
    } catch (error) {
      this.logger.add(`Ошибка отправки auth-команд: ${error.message}`);
    }
  }

  handleDisconnect(bot, reason) {
    if (bot !== this.bot) {
      return;
    }

    this.clearControlStates();
    this.bot = null;
    this.clearRandomActionTimer();
    this.clearStatusTimer();
    this.clearStuckTimer();
    this.clearMobScanTimer();
    this.clearKeepaliveTimer();
    this.clearWaterSurvivalTimer();
    this.onlineSince = null;
    try { if (bot.pathfinder && typeof bot.pathfinder.stop === 'function') bot.pathfinder.stop(); } catch (_) {}
    this.logger.add(`Соединение закрыто: ${reason || 'без причины'}`);

    if (!this.started) {
      this.setStatus('offline');
      return;
    }

    if (this.reconnecting || this.reconnectTimer) {
      return;
    }

    this.setStatus('error');
    this._scheduleReconnect(this.instanceId);
  }

  handleError(bot, error) {
    if (bot !== this.bot) {
      return;
    }

    const msg = (error && error.message) || '';

    if (msg.includes('Unsupported protocol version') || msg.includes('minecraftVersion')) {
      this.logger.add('⚠️ Сервер не ответил на ping (выключен или перезапускается).');
      if (!this.config.version && !this._versionWarnSent) {
        this._versionWarnSent = true;
        this.notifyAdmin(
          '⚠️ MC_VERSION не задан! Без версии бот не может разбудить спящий Aternos.\n' +
          'Задайте версию: ⚙️ → 🖥 Сервер → Версия (например 1.20.4).',
          { persistent: true }
        );
      }
      if (!this.reconnecting && !this.reconnectTimer) {
        this._scheduleReconnect(this.instanceId);
      }
      return;
    }

    this.logger.add(`Ошибка Mineflayer: ${msg}`);

    if (msg && msg.includes('No data available for version')) {
      this.logger.add('Версия Minecraft не поддерживается.');
      this.setStatus('version_error');
      this.notifyAdmin('🔴 Версия Minecraft не поддерживается. Укажите MC_VERSION в .env.', { persistent: true });
      this.stop('Версия не поддерживается', false);
      return;
    }

    this.setStatus('error');
    this.clearRandomActionTimer();
    this.clearStatusTimer();
    this.clearStuckTimer();
    this.clearMobScanTimer();
    this.clearKeepaliveTimer();

    if (this.reconnecting || this.reconnectTimer) {
      return;
    }
    this._scheduleReconnect(this.instanceId);
  }

  handleDeath(bot) {
    if (bot !== this.bot) {
      return;
    }

    const now = Date.now();
    if (now - this.deathWindowStart > 60000) {
      this.deathWindowStart = now;
      this.deathCount = 0;
    }
    this.deathCount += 1;
    this.lastDeathAt = now;

    this.clearControlStates();

    let pauseMs = 15000;
    if (this.deathCount >= 3) {
      pauseMs = 60000;
      this.logger.add('⚠️ Петля смертей: AFK на паузе 60 сек.');
      if (this.deathCount === 3) {
        this.notifyAdmin(
          '☠️ Бот умирает в петле — возможно, спавн в пустоте или анти-бот плагин. Проверьте сервер.',
          { persistent: true }
        );
      }
    }
    this.afkPausedUntil = now + pauseMs;
    this.logger.add(`Бот умер (${this.deathCount}). Пауза AFK ${Math.round(pauseMs / 1000)}с, респавн через 5с.`);

    setTimeout(() => {
      if (bot !== this.bot) {
        return;
      }

      try {
        if (typeof bot.respawn === 'function') {
          bot.respawn();
          return;
        }

        if (bot._client) {
          bot._client.write('client_command', { actionId: 0 });
        }
      } catch (error) {
        this.logger.add(`Ошибка респавна: ${error.message}`);
      }
    }, 5000);
  }

  handlePlayers(bot, players) {
    if (bot !== this.bot) {
      return;
    }

    let duplicateCount = 0;

    for (const player of Object.values(players)) {
      if (player && player.username === this.activeUsername) {
        duplicateCount += 1;
      }
    }

    if (duplicateCount > 1) {
      this.logger.add('Обнаружен дубликат ника. Останавливаю бота.');
      this.notifyAdmin('⚠️ Обнаружен дубликат ника. Бот остановлен.', { persistent: true });
      this.stop('Обнаружен дубликат ника', false);
    }
  }

  ensureStatusTimer() {
    this.clearStatusTimer();
    this.statusTimer = setInterval(() => {
      if (this.started && this.status === 'online') {
        this.logger.add('Статус: бот онлайн.');
      }
    }, this.config.statusIntervalMs);
  }

  startRandomActions() {
    this.clearRandomActionTimer();
    this.firstActionDone = false;
    this.scheduleNextAction();
  }

  scheduleNextAction() {
    if (!this.started || this.status !== 'online') {
      return;
    }

    let delay;
    if (!this.firstActionDone) {
      delay = Math.floor(randomBetween(5000, 10000));
    } else {
      const base = this.config.randomActionIntervalMs;
      const jitter = (Math.random() - 0.5) * base * 0.8;
      delay = Math.max(5000, Math.floor(base + jitter));
    }

    this.randomActionTimer = setTimeout(() => {
      this.randomActionTimer = null;
      this.performRandomAction();
      this.firstActionDone = true;
      if (this.started && this.status === 'online') {
        this.scheduleNextAction();
      }
    }, delay);
  }

  performRandomAction() {
    if (!this.bot || this.status !== 'online') {
      return;
    }

    if (Date.now() < this.afkPausedUntil) {
      return;
    }

    if (Date.now() < this.fleeingUntil) {
      return;
    }

    if (this._inWaterSince) {
      return;
    }

    const onGround = this.isStandingOnSolid();

    let action = weightedPick(AFK_ACTIONS);
    if (!onGround) {
      action = 'rotate';
    }

    this.afkActionCount += 1;
    this.lastActionAt = Date.now();

    const activeBot = this.bot;
    const myInstanceId = this.instanceId;

    const releaseStates = (states, delay) => {
      setTimeout(() => {
        if (activeBot !== this.bot || myInstanceId !== this.instanceId) return;
        for (const s of states) {
          try { activeBot.setControlState(s, false); } catch (_) {}
        }
      }, delay);
    };

    try {
      switch (action) {
        case 'jump': {
          this._afkLog('AFK: jump');
          activeBot.setControlState('jump', true);
          releaseStates(['jump'], Math.floor(randomBetween(400, 700)));
          break;
        }

        case 'move':
        case 'move_sprint':
        case 'combo_jump_move': {
          if (this.config.smartAfk && this._pathfinderAvailable && activeBot.pathfinder) {
            const sprint = (action === 'move_sprint');
            this._afkWander({ sprint }).catch((e) => {
              this.logger.add(`Smart-AFK ошибка: ${e.message}`);
            });
            break;
          }
          const candidates = (action === 'combo_jump_move')
            ? ['forward', 'left', 'right']
            : ['forward', 'back', 'left', 'right'];
          const dir = this.pickSafeDirection(candidates);
          if (!dir) {
            this.logger.add(`AFK ${action} заменён на jump: окружение опасно.`);
            activeBot.setControlState('jump', true);
            releaseStates(['jump'], 500);
            break;
          }
          const duration = action === 'move'
            ? Math.floor(randomBetween(900, 2400))
            : action === 'move_sprint'
              ? Math.floor(randomBetween(1500, 3200))
              : Math.floor(randomBetween(600, 900));
          this._afkLog(`AFK: ${action} → ${dir}`);
          this.faceDirection(dir).then(() => {
            if (activeBot !== this.bot || myInstanceId !== this.instanceId) return;
            if (action === 'move_sprint') activeBot.setControlState('sprint', true);
            if (action === 'combo_jump_move') activeBot.setControlState('jump', true);
            activeBot.setControlState('forward', true);
            this.scheduleHeadWobble(duration);
            const states = action === 'move_sprint'
              ? ['sprint', 'forward']
              : action === 'combo_jump_move'
                ? ['jump', 'forward']
                : ['forward'];
            releaseStates(states, duration);
          });
          break;
        }

        case 'sneak': {
          this._afkLog('AFK: sneak');
          activeBot.setControlState('sneak', true);
          releaseStates(['sneak'], Math.floor(randomBetween(800, 2000)));
          break;
        }

        case 'look_around': {
          this._afkLog('AFK: look around');
          const steps = 3 + Math.floor(Math.random() * 3);
          for (let i = 0; i < steps; i += 1) {
            const at = i * Math.floor(randomBetween(450, 800));
            setTimeout(() => {
              if (activeBot !== this.bot || myInstanceId !== this.instanceId) return;
              try {
                const yaw = (Math.random() - 0.5) * Math.PI * 2;
                const pitch = (Math.random() - 0.5) * 0.7;
                activeBot.look(yaw, pitch, false);
              } catch (_) {}
            }, at);
          }
          break;
        }

        case 'rotate':
        default: {
          this._afkLog('AFK: rotate');
          const yaw = Math.random() * Math.PI * 2;
          const pitch = (Math.random() - 0.5) * (Math.PI / 2.6);
          activeBot.look(yaw, pitch, true);
          break;
        }
      }
    } catch (error) {
      this.logger.add(`Ошибка AFK-действия (${action}): ${error.message}`);
    }
  }

  clearControlStates() {
    if (!this.bot) return;
    for (const state of AFK_CONTROL_STATES) {
      try {
        this.bot.setControlState(state, false);
      } catch (_) {}
    }
  }

  clearRandomActionTimer() {
    if (this.randomActionTimer) {
      clearTimeout(this.randomActionTimer);
      this.randomActionTimer = null;
    }
  }

  clearStatusTimer() {
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  shutdown() {
    this.stop('Завершение процесса', false);
  }
}

module.exports = {
  MinecraftController
};
