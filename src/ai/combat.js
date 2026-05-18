const ARMOR_TIERS = {
  netherite: 6,
  diamond: 5,
  iron: 4,
  chainmail: 3,
  golden: 2,
  leather: 1,
  turtle: 3
};

const WEAPON_TIERS = {
  netherite_sword: 10,
  diamond_sword: 9,
  netherite_axe: 8,
  diamond_axe: 7,
  iron_sword: 6,
  iron_axe: 5,
  stone_sword: 4,
  stone_axe: 3,
  golden_sword: 2,
  wooden_sword: 1
};

const DANGEROUS_MOBS = new Set(['creeper', 'warden', 'wither', 'ender_dragon', 'ravager']);

class Combat {
  constructor({ bot, logger }) {
    this.bot = bot;
    this.logger = logger;
    this._lastAttackAt = 0;
    this._armorEquippedAt = 0;
  }

  setBot(bot) {
    this.bot = bot;
    this._lastAttackAt = 0;
    this._armorEquippedAt = 0;
  }

  hasWeapon() {
    const bot = this.bot;
    if (!bot || !bot.inventory) return false;
    return bot.inventory.items().some((it) => WEAPON_TIERS[it.name] !== undefined);
  }

  bestWeapon() {
    const bot = this.bot;
    if (!bot || !bot.inventory) return null;
    let best = null;
    let bestTier = -1;
    for (const it of bot.inventory.items()) {
      const tier = WEAPON_TIERS[it.name];
      if (tier !== undefined && tier > bestTier) {
        best = it;
        bestTier = tier;
      }
    }
    return best;
  }

  bestArmor(slotSuffix) {
    const bot = this.bot;
    if (!bot || !bot.inventory) return null;
    let best = null;
    let bestTier = -1;
    for (const it of bot.inventory.items()) {
      if (!it.name.endsWith('_' + slotSuffix)) continue;
      const material = it.name.replace('_' + slotSuffix, '');
      const tier = ARMOR_TIERS[material] || 0;
      if (tier > bestTier) {
        best = it;
        bestTier = tier;
      }
    }
    return best;
  }

  async equipBestArmor() {
    const bot = this.bot;
    if (!bot) return;
    const now = Date.now();
    if (now - this._armorEquippedAt < 30000) return;
    this._armorEquippedAt = now;
    const map = [
      ['helmet', 'head'],
      ['chestplate', 'torso'],
      ['leggings', 'legs'],
      ['boots', 'feet']
    ];
    for (const [suffix, slot] of map) {
      const item = this.bestArmor(suffix);
      if (!item) continue;
      try {
        await bot.equip(item, slot);
      } catch (_) {}
    }
  }

  shouldEngage(hostile) {
    const bot = this.bot;
    if (!bot || !bot.entity || !hostile || !hostile.position) return false;
    if (DANGEROUS_MOBS.has(hostile.name)) return false;
    if (!this.hasWeapon()) return false;
    const d = bot.entity.position.distanceTo(hostile.position);
    return d < 3;
  }

  async attack(hostile) {
    const bot = this.bot;
    if (!bot) return { ok: false };
    const now = Date.now();
    if (now - this._lastAttackAt < 600) return { ok: false, reason: 'cooldown' };

    const weapon = this.bestWeapon();
    if (weapon && (!bot.heldItem || bot.heldItem.name !== weapon.name)) {
      try { await bot.equip(weapon, 'hand'); } catch (_) {}
    }

    try {
      const targetPoint = hostile.position.offset(0, (hostile.height || 1.5) * 0.85, 0);
      bot.lookAt(targetPoint, true);
    } catch (_) {}

    try {
      bot.attack(hostile);
      this._lastAttackAt = now;
      this.logger.add(`⚔️ Атака ${hostile.name} (${weapon ? weapon.name : 'bare hand'}).`);
      return { ok: true };
    } catch (error) {
      this.logger.add(`Combat ошибка: ${error.message}`);
      return { ok: false, reason: error.message };
    }
  }
}

module.exports = { Combat };
