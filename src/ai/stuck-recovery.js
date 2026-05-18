const PLACEABLE_PRIORITY = [
  'cobblestone', 'cobbled_deepslate', 'dirt', 'andesite', 'granite', 'diorite',
  'netherrack', 'stone', 'sandstone'
];

class StuckLadder {
  constructor({ bot, logger, controller, goals, runWithTimeout, timeoutMs = 2000 }) {
    this.bot = bot;
    this.logger = logger;
    this.controller = controller;
    this.goals = goals;
    this.runWithTimeout = runWithTimeout;
    this.timeoutMs = timeoutMs;
    this.attempt = 0;
    this._running = false;
  }

  reset() {
    this.attempt = 0;
  }

  setBot(bot) { this.bot = bot; }

  async trigger(reason) {
    if (this._running) return;
    if (!this.bot) return;
    this._running = true;
    const cur = this.attempt;
    try {
      this.logger.add(`Stuck recovery attempt ${cur} (${reason}).`);
      switch (cur) {
        case 0: await this.pathfindRandomNearby(); break;
        case 1: await this.pillarUp(); break;
        case 2: await this.digDown(); break;
        default:
          if (this.controller && typeof this.controller.forceEscape === 'function') {
            this.controller.forceEscape();
          }
          break;
      }
      this.attempt = (cur + 1) % 4;
    } catch (error) {
      this.logger.add(`Stuck recovery ошибка: ${error.message}`);
      this.attempt = (cur + 1) % 4;
    } finally {
      this._running = false;
    }
  }

  async pathfindRandomNearby() {
    const bot = this.bot;
    if (!bot || !bot.pathfinder || !this.goals.GoalNear) return;
    const me = bot.entity && bot.entity.position;
    if (!me) return;
    const { isDangerousFallAt, avoidWater } = (this.controller && this.controller._stuckCtx()) || {};

    for (let i = 0; i < 5; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const r = 5 + Math.floor(Math.random() * 4);
      const x = Math.floor(me.x + Math.cos(angle) * r);
      const z = Math.floor(me.z + Math.sin(angle) * r);
      const y = Math.floor(me.y);
      if (typeof isDangerousFallAt === 'function') {
        if (isDangerousFallAt(bot, x, y, z, { avoidWater, maxSafeFall: 3, scanDepth: 24 })) continue;
      }
      const goal = new this.goals.GoalNear(x, y, z, 1);
      const r2 = await this.runWithTimeout(bot, goal, this.timeoutMs);
      if (r2.ok) {
        this.logger.add(`Stuck: pathfind в (${x},${z}) сработал.`);
        return;
      }
    }
    this.logger.add('Stuck: pathfind не нашёл безопасный маршрут.');
  }

  async pillarUp() {
    const bot = this.bot;
    if (!bot || !bot.entity) return;
    const item = this._findPlaceableItem();
    if (!item) {
      this.logger.add('Stuck: pillarUp пропущен — нет блоков в инвентаре.');
      return;
    }
    try {
      await bot.equip(item, 'hand');
    } catch (_) {
      return;
    }
    const me = bot.entity.position;
    const Vec3 = me.constructor;
    const below = bot.blockAt(new Vec3(Math.floor(me.x), Math.floor(me.y) - 1, Math.floor(me.z)));
    if (!below || below.name === 'air') {
      this.logger.add('Stuck: pillarUp — нет опорного блока ниже.');
      return;
    }
    try {
      bot.setControlState('jump', true);
      await new Promise((r) => setTimeout(r, 250));
      await bot.placeBlock(below, new Vec3(0, 1, 0));
      this.logger.add(`Stuck: pillarUp выполнен (${item.name}).`);
    } catch (error) {
      this.logger.add(`Stuck: pillarUp не удался: ${error.message}`);
    } finally {
      try { bot.setControlState('jump', false); } catch (_) {}
    }
  }

  async digDown() {
    const bot = this.bot;
    if (!bot || !bot.entity) return;
    const me = bot.entity.position;
    const Vec3 = me.constructor;
    const below = bot.blockAt(new Vec3(Math.floor(me.x), Math.floor(me.y) - 1, Math.floor(me.z)));
    if (!below) return;
    const name = below.name || '';
    if (name === 'air' || name === 'cave_air' || name === 'bedrock' || name === 'lava' || name === 'flowing_lava') {
      this.logger.add(`Stuck: digDown пропущен — блок ${name}.`);
      return;
    }
    try {
      if (typeof bot.canDigBlock === 'function' && !bot.canDigBlock(below)) {
        this.logger.add(`Stuck: digDown пропущен — нет инструмента для ${name}.`);
        return;
      }
      await bot.dig(below);
      this.logger.add(`Stuck: digDown (${name}) выполнен.`);
    } catch (error) {
      this.logger.add(`Stuck: digDown не удался: ${error.message}`);
    }
  }

  _findPlaceableItem() {
    const bot = this.bot;
    if (!bot || !bot.inventory) return null;
    const items = bot.inventory.items();
    for (const preferred of PLACEABLE_PRIORITY) {
      const found = items.find((it) => it.name === preferred);
      if (found) return found;
    }
    return items.find((it) => /(_block|cobble|stone|dirt|sand|netherrack|wood|planks)/.test(it.name));
  }
}

module.exports = { StuckLadder };
