function perpendicular(dx, dz) {
  return [
    { x: -dz, z: dx },
    { x: dz, z: -dx }
  ];
}

function vecLen(x, z) {
  return Math.sqrt(x * x + z * z) || 1;
}

async function runAway(bot, hostile, ctx, goals) {
  const { GoalInvert, GoalFollow } = goals;
  const goal = new GoalInvert(new GoalFollow(hostile, ctx.fleeDistance || 16));
  return ctx.runWithTimeout(bot, goal, ctx.timeoutMs || 1500);
}

async function dodgeCreeper(bot, hostile, ctx, goals) {
  const { GoalNear } = goals;
  const me = bot.entity.position;
  const dx = me.x - hostile.position.x;
  const dz = me.z - hostile.position.z;
  const dist = vecLen(dx, dz);

  if (dist < 3.5) {
    try { bot.pathfinder.stop(); } catch (_) {}
    const perp = perpendicular(dx / dist, dz / dist);
    const idx = Math.random() < 0.5 ? 0 : 1;
    const p = perp[idx];
    const yaw = Math.atan2(-p.x, p.z);
    try { bot.look(yaw, 0, true); } catch (_) {}
    try {
      bot.setControlState('sprint', true);
      bot.setControlState('forward', true);
    } catch (_) {}
    setTimeout(() => {
      try {
        bot.setControlState('sprint', false);
        bot.setControlState('forward', false);
      } catch (_) {}
    }, 400);
    return { ok: true, reason: 'emergency_perp' };
  }

  const perp = perpendicular(dx / dist, dz / dist);
  const candidates = [];
  for (const p of perp) {
    const yaw = Math.atan2(-p.x, p.z);
    if (ctx.isBlacklisted && ctx.isBlacklisted(yaw)) continue;
    candidates.push({ p, yaw });
  }
  if (candidates.length === 0) {
    return runAway(bot, hostile, ctx, goals);
  }
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const target = me.offset(chosen.p.x * 8, 0, chosen.p.z * 8).floored();
  const goal = new GoalNear(target.x, target.y, target.z, 1);
  const result = await ctx.runWithTimeout(bot, goal, ctx.timeoutMs || 1500);
  if (!result.ok && ctx.recordFail) ctx.recordFail(chosen.yaw);
  return result;
}

async function breakLineOfSight(bot, hostile, ctx, goals) {
  const { GoalNear } = goals;
  const me = bot.entity.position;

  const candidates = [];
  for (let r = 4; r <= 10; r += 2) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
      const x = Math.floor(me.x + Math.cos(angle) * r);
      const z = Math.floor(me.z + Math.sin(angle) * r);
      const y = Math.floor(me.y);
      if (hasObstructionBetween(bot, { x: x + 0.5, y: y + 1.5, z: z + 0.5 }, hostile.position)) {
        const yaw = Math.atan2(-(x - me.x), z - me.z);
        if (ctx.isBlacklisted && ctx.isBlacklisted(yaw)) continue;
        candidates.push({ x, y, z, yaw });
      }
    }
  }

  if (candidates.length === 0) {
    return runAway(bot, hostile, ctx, goals);
  }

  candidates.sort((a, b) => {
    const da = (a.x - me.x) ** 2 + (a.z - me.z) ** 2;
    const db = (b.x - me.x) ** 2 + (b.z - me.z) ** 2;
    return da - db;
  });
  const c = candidates[0];
  const goal = new GoalNear(c.x, c.y, c.z, 1);
  const result = await ctx.runWithTimeout(bot, goal, ctx.timeoutMs || 1500);
  if (!result.ok && ctx.recordFail) ctx.recordFail(c.yaw);
  return result;
}

function hasObstructionBetween(bot, from, to) {
  try {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) * 4);
    if (steps <= 0) return false;
    const Vec3 = bot.entity.position.constructor;
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const px = Math.floor(from.x + dx * t);
      const py = Math.floor(from.y + dy * t);
      const pz = Math.floor(from.z + dz * t);
      const block = bot.blockAt(new Vec3(px, py, pz));
      if (!block) continue;
      const name = block.name || '';
      if (name === 'air' || name === 'cave_air' || name === 'void_air') continue;
      if (name === 'water' || name === 'flowing_water') continue;
      if (block.boundingBox === 'block') return true;
    }
  } catch (_) {}
  return false;
}

async function dropDown(bot, hostile, ctx, goals) {
  const { GoalY } = goals;
  const me = bot.entity.position;
  const goal = new GoalY(Math.floor(me.y) - 3);
  const r = await ctx.runWithTimeout(bot, goal, 1500);
  if (r.ok) return r;
  return runAway(bot, hostile, ctx, goals);
}

async function seekCover(bot, hostile, ctx, goals) {
  const { GoalNear } = goals;
  const me = bot.entity.position;
  const Vec3 = me.constructor;
  for (let r = 2; r <= 8; r += 1) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const x = Math.floor(me.x + Math.cos(angle) * r);
      const z = Math.floor(me.z + Math.sin(angle) * r);
      const y = Math.floor(me.y);
      for (let dy = 2; dy <= 5; dy += 1) {
        const above = bot.blockAt(new Vec3(x, y + dy, z));
        if (above && above.boundingBox === 'block') {
          const goal = new GoalNear(x, y, z, 1);
          const result = await ctx.runWithTimeout(bot, goal, 1500);
          if (result.ok) return result;
          break;
        }
      }
    }
  }
  return runAway(bot, hostile, ctx, goals);
}

async function freezeAndSneak(bot, hostile, ctx) {
  try { bot.pathfinder.stop(); } catch (_) {}
  try {
    bot.clearControlStates();
    bot.setControlState('sneak', true);
  } catch (_) {}
  if (ctx.notifyAdmin) ctx.notifyAdmin('⚠️ Warden обнаружен — замираю в режиме sneak.', { persistent: true });
  return { ok: true, reason: 'frozen' };
}

async function bossAlert(bot, hostile, ctx) {
  try { bot.pathfinder.stop(); } catch (_) {}
  try { bot.clearControlStates(); } catch (_) {}
  if (ctx.notifyAdmin) ctx.notifyAdmin(`☠️ ${hostile.name} обнаружен. Прекращаю активность.`, { persistent: true });
  return { ok: true, reason: 'boss' };
}

const STRATEGIES = {
  creeper:         { fn: dodgeCreeper,     critical: 5 },
  skeleton:        { fn: breakLineOfSight, critical: 12 },
  stray:           { fn: breakLineOfSight, critical: 12 },
  wither_skeleton: { fn: runAway,          critical: 5 },
  witch:           { fn: breakLineOfSight, critical: 10 },
  pillager:        { fn: breakLineOfSight, critical: 12 },
  vindicator:      { fn: runAway,          critical: 4 },
  evoker:          { fn: breakLineOfSight, critical: 10 },
  spider:          { fn: dropDown,         critical: 5 },
  cave_spider:     { fn: dropDown,         critical: 5 },
  phantom:         { fn: seekCover,        critical: 8 },
  warden:          { fn: freezeAndSneak,   critical: 16 },
  wither:          { fn: bossAlert,        critical: 32 },
  ender_dragon:    { fn: bossAlert,        critical: 32 },
  blaze:           { fn: breakLineOfSight, critical: 12 },
  ghast:           { fn: breakLineOfSight, critical: 16 }
};

function forMob(name) {
  return STRATEGIES[name] || { fn: runAway, critical: 4 };
}

module.exports = { forMob, runAway };
