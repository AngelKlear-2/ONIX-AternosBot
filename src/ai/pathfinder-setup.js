let cached = null;

function loadModule(logger) {
  if (cached) return cached;
  try {
    const mod = require('mineflayer-pathfinder');
    cached = { ok: true, ...mod };
  } catch (error) {
    if (logger) logger.add(`Pathfinder не загружен: ${error.message}`);
    cached = { ok: false, goals: {}, pathfinder: null, Movements: null };
  }
  return cached;
}

function attach(bot, { logger } = {}) {
  const mod = loadModule(logger);
  if (!mod.ok) return { ok: false, goals: {} };

  try {
    bot.loadPlugin(mod.pathfinder);
  } catch (error) {
    if (logger) logger.add(`Pathfinder loadPlugin: ${error.message}`);
    return { ok: false, goals: {} };
  }

  bot.once('spawn', () => {
    try {
      const m = new mod.Movements(bot);
      m.allowParkour = true;
      m.allowSprinting = true;
      m.canDig = false;
      m.allow1by1towers = false;
      m.maxDropDown = 4;
      m.scafoldingBlocks = [];
      bot.pathfinder.setMovements(m);
      bot._onixMovements = m;
      if (logger) logger.add('Pathfinder готов: Movements инициализированы.');
    } catch (error) {
      if (logger) logger.add(`Ошибка инициализации Movements: ${error.message}`);
    }
  });

  return { ok: true, goals: mod.goals };
}

async function runWithTimeout(bot, goal, timeoutMs) {
  if (!bot || !bot.pathfinder || !goal) {
    return { ok: false, reason: 'no_pathfinder' };
  }
  let timeoutHandle = null;
  let resolved = false;
  return new Promise((resolve) => {
    const finish = (payload) => {
      if (resolved) return;
      resolved = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve(payload);
    };
    timeoutHandle = setTimeout(() => {
      try { bot.pathfinder.stop(); } catch (_) {}
      finish({ ok: false, reason: 'timeout' });
    }, timeoutMs);

    Promise.resolve(bot.pathfinder.goto(goal))
      .then(() => finish({ ok: true }))
      .catch((error) => {
        const msg = (error && error.message) || String(error);
        if (msg.includes('GoalChanged') || msg.includes('PathStopped')) {
          finish({ ok: false, reason: 'cancelled' });
        } else {
          finish({ ok: false, reason: msg });
        }
      });
  });
}

module.exports = { attach, loadModule, runWithTimeout };
