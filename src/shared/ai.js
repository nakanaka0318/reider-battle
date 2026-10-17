// NPC の AI：スカブ／レイダー／ボス・護衛／ARC 機械
import { ITEMS, weaponStats, itemValue } from './items.js';
import { MACHINES } from './bots.js';
import { dirFromYawPitch, yawTo, angleDiff, clamp } from './math.js';
import { allItems, autoInsert, removeItem, countAmmo, listGrids, findItem } from './inventory.js';
import { totalHp, TOTAL_HP, humanHeight, moveFactor } from './combat.js';

const SKILL = { scav: 0.36, raider1: 0.7, raider2: 0.82, boss: 0.9, guard: 0.8 };
const RANGE = { pistol: 30, smg: 45, shotgun: 22, rifle: 85, dmr: 130, sniper: 180, lmg: 95 };
const TOD_SIGHT = { day: 1, dusk: 0.75, night: 0.42 };

export function initAI(raid, a, opts) {
  const rng = raid.rng;
  a.ai = {
    state: 'idle', zone: opts.zone || null, tier: opts.tier, leader: opts.leader || null,
    path: null, pi: 0, goal: null, pathFail: 0,
    target: null, lastSeen: null, lastSeenT: -99, seen: false, detect: {}, firstSeenT: 0,
    aimErrX: 0, aimErrY: 0, burst: 0, pauseUntil: 0, strafe: rng() < 0.5 ? 1 : -1, strafeT: 0,
    thinkT: rng() * 0.3, idleUntil: raid.time + rng() * 3, stuckT: 0, lastP: { x: a.pos.x, z: a.pos.z }, stuckCheck: raid.time + 2,
    skill: a.kind === 'machine' ? 0.6 : SKILL[opts.tier] ?? 0.5,
    lootTarget: null, lootUntil: 0, lootedSet: new Set(),
    extractAt: raid.time + 420 + rng() * 840, poiVisited: new Set(),
    investigate: null, alerted: false, wantCrouch: false, healCooldown: 0, nadeCooldown: raid.time + 10,
    hover: rng() * 6.28, home: { x: a.pos.x, z: a.pos.z }, speedMul: 1,
  };
}

function eye(a) {
  if (a.kind === 'machine') {
    const M = MACHINES[a.mtype];
    return { x: a.pos.x, y: a.pos.y + (M.fly ? 0 : M.mtypeEye || (a.mtype === 'sentinel' ? 3.4 : 0.6)), z: a.pos.z };
  }
  return { x: a.pos.x, y: a.pos.y + (a.crouch ? 1.05 : 1.62), z: a.pos.z };
}
function chest(t) {
  if (t.kind === 'machine') {
    const M = MACHINES[t.mtype];
    return { x: t.pos.x, y: t.pos.y + (M.fly ? 0 : t.mtype === 'sentinel' ? 2.7 : 0.5), z: t.pos.z };
  }
  return { x: t.pos.x, y: t.pos.y + humanHeight(t) * 0.7, z: t.pos.z };
}

function canSee(raid, a, t, range) {
  const e = eye(a), c = chest(t);
  const dx = c.x - e.x, dz = c.z - e.z, dy = c.y - e.y;
  const d = Math.hypot(dx, dy, dz);
  if (d > range) return false;
  if (!raid.world.lineOfSight(e, c, { ignoreTrees: false })) {
    // 頭だけ見えている場合
    if (t.kind === 'machine') return false;
    const h = { x: t.pos.x, y: t.pos.y + humanHeight(t) - 0.1, z: t.pos.z };
    if (!raid.world.lineOfSight(e, h)) return false;
  }
  if (raid.smokeBlocks(e, c)) return false;
  return true;
}

// ---------------------------------------------------------------- 知覚・意思決定（5Hz）
export function aiThink(raid, a) {
  const ai = a.ai;
  if (a.stunUntil && raid.time < a.stunUntil) return;
  if (a.flashUntil && raid.time < a.flashUntil) { ai.seen = false; return; }
  const isM = a.kind === 'machine';
  const M = isM ? MACHINES[a.mtype] : null;
  const tod = TOD_SIGHT[raid.opts.timeOfDay] ?? 1;
  const baseRange = isM ? M.sight : a.kind === 'scav' ? 75 : 120;
  const fov = isM ? (a.mtype === 'sentinel' ? 0.5 : -0.2) : a.kind === 'scav' ? 0.35 : 0.2; // cos

  // 知覚
  let best = null, bestScore = 0, checks = 0;
  const fwd = dirFromYawPitch(a.yaw, 0);
  const cand = [];
  for (const t of raid.actors.values()) {
    if (!t.alive || t.extracted || !raid.hostile(a, t)) continue;
    // スポーン直後のレイダー同士は互いを無視（同じ地点に出現した場合の即死を防ぐ）
    if ((a.kind === 'raider' || a.kind === 'player') && (t.kind === 'raider' || t.kind === 'player') && raid.time - Math.max(a.spawnT, t.spawnT) < 12 && t.lastHurt < 0) continue;
    const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z;
    const d = Math.hypot(dx, dz);
    let range = baseRange * (isM ? Math.max(0.7, tod) : tod);
    if (t.light) range = Math.max(range, baseRange * 1.1);
    if (d > range) { delete ai.detect[t.id]; continue; }
    cand.push({ t, d, dx, dz, range });
  }
  cand.sort((p, q) => p.d - q.d);
  for (const { t, d, dx, dz, range } of cand) {
    if (checks >= 4) break;
    const cos = (dx * fwd.x + dz * fwd.z) / (d || 1);
    const known = ai.target === t.id && raid.time - ai.lastSeenT < 4;
    if (cos < fov && d > 7 && !known) continue;
    checks++;
    if (!canSee(raid, a, t, range)) { if (ai.target === t.id) ai.seen = false; continue; }
    // 発見メーター
    let rate = (1.2 + 40 / (d + 4)) * (t.crouch ? 0.6 : 1) * (t.moving ? 1.3 : 0.75) * (t.sprint ? 1.3 : 1);
    if (isM) rate *= 1.4;
    if (known || ai.alerted) rate *= 4;
    ai.detect[t.id] = Math.min(1.5, (ai.detect[t.id] || 0) + rate * 0.22);
    if (ai.detect[t.id] >= 1) {
      const score = 100 / (d + 1) + (ai.target === t.id ? 2 : 0) + (t.kind === 'player' ? 0.5 : 0);
      if (score > bestScore) { bestScore = score; best = t; }
    }
  }
  if (best) {
    if (ai.target !== best.id) { ai.firstSeenT = raid.time; ai.aimErrX = (raid.rng() - 0.5) * 0.25; ai.aimErrY = (raid.rng() - 0.5) * 0.15; }
    ai.target = best.id; ai.seen = true; ai.lastSeen = { x: best.pos.x, y: best.pos.y, z: best.pos.z }; ai.lastSeenT = raid.time;
    ai.alerted = true;
    if (ai.state !== 'combat') { ai.state = 'combat'; ai.path = null; alertAllies(raid, a, best); }
  } else if (ai.target) {
    const t = raid.actors.get(ai.target);
    if (!t || !t.alive) { ai.target = null; ai.seen = false; ai.state = 'idle'; ai.alerted = false; }
    else ai.seen = false;
  }

  // 扉を開ける
  if (!isM || a.mtype === 'tick') {
    for (const d of Object.values(raid.world.doors)) {
      if (d.open) continue;
      if (Math.abs(d.x - a.pos.x) > 1.7 || Math.abs(d.z - a.pos.z) > 1.7) continue;
      if (d.locked && !raid.unlocked.has(d.id)) continue;
      if (Math.abs(d.y0 - a.pos.y) > 1) continue;
      raid.world.setDoor(d.id, true);
      raid.emit({ t: 'door', id: d.id, open: true, by: a.id });
    }
  }

  // 縄張りから離れすぎたら戻る
  if (leashed(a) && outOfLeash(a, a.pos, a.kind === 'machine' ? 35 : 70) && !ai.seen) {
    ai.target = null; ai.state = 'idle'; ai.alerted = false; ai.investigate = null; ai.flyGoal = null;
    const z = ai.zone;
    if (isM && M.fly) ai.flyGoal = { x: z.x, z: z.z };
    else if (!ai.path) planPath(raid, a, z.x, z.z, 120);
    return;
  }
  if (isM) return thinkMachine(raid, a, M);
  thinkHuman(raid, a);
}

function alertAllies(raid, a, target) {
  for (const o of raid.actors.values()) {
    if (o === a || !o.ai || !o.alive || o.team !== a.team || o.kind === 'machine') continue;
    if (Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z) > 35) continue;
    if (o.ai.state !== 'combat') {
      o.ai.investigate = { x: target.pos.x, z: target.pos.z };
      o.ai.alerted = true;
      o.ai.state = 'search'; o.ai.searchUntil = raid.time + 20; o.ai.path = null;
    }
  }
}

function hpFrac(a) { return totalHp(a.health) / (TOTAL_HP + (a.kind === 'boss' ? 65 : 0)); }

function thinkHuman(raid, a) {
  const ai = a.ai;
  const t = ai.target ? raid.actors.get(ai.target) : null;
  // 武器確認
  const w = a.inv.equip[a.slot];
  if (!w) {
    a.slot = a.inv.equip.primary ? 'primary' : a.inv.equip.holster ? 'holster' : a.slot;
  } else if (w.mag && w.mag.count === 0 && raid.time >= a.w.reloadUntil) {
    const avail = countAmmo(a.inv, ITEMS[w.id].weapon.caliber);
    if (Object.keys(avail).length) raid.startReload(a);
    else if (a.slot !== 'holster' && a.inv.equip.holster) a.slot = 'holster';
    else if (a.slot === 'holster' && a.inv.equip.primary) a.slot = 'primary';
  }
  // 回復
  const hurt = hpFrac(a) < 0.6 || Object.values(a.health.bleed).some((v) => v) || Object.keys(a.health.fracture).length;
  const heavy = Object.values(a.health.bleed).some((v) => v === 2);
  if (hurt && !a.w.useItem && raid.time > ai.healCooldown && (!ai.seen || raid.time - ai.lastSeenT > 1.5 || (heavy && raid.time - a.lastHurt > 1.2))) {
    const med = pickMed(a);
    if (med) {
      raid.startUse(a, med.uid);
      ai.healCooldown = raid.time + 3;
    }
  }
  // 状態遷移
  if (ai.state === 'combat') {
    if (!t || !t.alive) { ai.state = 'idle'; ai.target = null; return; }
    // 重装の機械には勝ち目がない：距離を取る
    if (t.kind === 'machine' && t.mtype === 'sentinel' && a.kind !== 'boss') {
      const wpen = w?.mag ? ITEMS[w.mag.ammo]?.ammo?.pen || 0 : 0;
      if (wpen < 45 && raid.time > (ai.fleeT || 0)) {
        const ang = Math.atan2(a.pos.z - t.pos.z, a.pos.x - t.pos.x) + (raid.rng() - 0.5);
        const p = raid.world.nearestWalkable(a.pos.x + Math.cos(ang) * 45, a.pos.z + Math.sin(ang) * 45, 10);
        if (p) { planPath(raid, a, p.x, p.z, 60); ai.fleeT = raid.time + 6; }
      }
    }
    if (!ai.seen && raid.time - ai.lastSeenT > 2.5) {
      ai.state = 'search'; ai.searchUntil = raid.time + 14 + raid.rng() * 10; ai.investigate = outOfLeash(a, ai.lastSeen, 50) ? null : ai.lastSeen; ai.path = null;
    }
    // 手榴弾
    if (!ai.seen && raid.time > ai.nadeCooldown && a.kind !== 'scav' && ai.lastSeen) {
      const d = Math.hypot(ai.lastSeen.x - a.pos.x, ai.lastSeen.z - a.pos.z);
      if (d > 8 && d < 28 && raid.time - ai.lastSeenT < 6 && raid.rng() < 0.3) {
        if (raid.throwBotGrenade(a, ai.lastSeen)) ai.nadeCooldown = raid.time + 25;
      }
    }
    // 交戦距離調整
    if (ai.seen && t) {
      const d = Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z);
      const cls = w ? ITEMS[w.id].weapon.class : 'pistol';
      const pref = RANGE[cls] * 0.6;
      if (d > RANGE[cls] * 0.95 && raid.time > (ai.repathT || 0) && !outOfLeash(a, t.pos, 50)) { planPath(raid, a, t.pos.x, t.pos.z, 60); ai.repathT = raid.time + 2.5; }
      else if (d < pref * 1.1) ai.path = null;
      ai.wantCrouch = d > 30 && raid.rng() < 0.4 && cls !== 'shotgun';
    } else if (ai.lastSeen && raid.time > (ai.repathT || 0) && raid.time - ai.lastSeenT > 1) {
      // 遮蔽物の向こうへ回り込む
      if (a.kind !== 'boss' && raid.rng() < 0.5 && !outOfLeash(a, ai.lastSeen, 50)) planPath(raid, a, ai.lastSeen.x, ai.lastSeen.z, 50);
      ai.repathT = raid.time + 3;
    }
    return;
  }
  ai.wantCrouch = false;
  if (ai.state === 'search') {
    if (raid.time > ai.searchUntil) { ai.state = 'idle'; ai.alerted = false; ai.path = null; return; }
    if (!ai.path && ai.investigate) {
      if (Math.hypot(ai.investigate.x - a.pos.x, ai.investigate.z - a.pos.z) < 3) { ai.investigate = null; ai.idleUntil = raid.time + 2; }
      else planPath(raid, a, ai.investigate.x, ai.investigate.z, 80);
    }
    if (!ai.path && !ai.investigate && raid.time > ai.idleUntil) {
      const p = raid.randomPointIn(a.pos.x, a.pos.z, 15);
      if (p) planPath(raid, a, p.x, p.z, 25);
      ai.idleUntil = raid.time + 3;
    }
    return;
  }
  // 平常時
  if (a.kind === 'raider') return thinkRaider(raid, a);
  if (a.kind === 'guard') {
    const L = raid.actors.get(ai.leader);
    if (L && L.alive) {
      const d = Math.hypot(L.pos.x - a.pos.x, L.pos.z - a.pos.z);
      if (d > 6 && !ai.path) planPath(raid, a, L.pos.x + (raid.rng() - 0.5) * 4, L.pos.z + (raid.rng() - 0.5) * 4, 40);
      return;
    }
  }
  // スカブ／ボス：巡回
  if (!ai.path && raid.time > ai.idleUntil) {
    const z = ai.zone;
    const p = z ? raid.randomPointIn(z.x, z.z, a.kind === 'boss' ? z.r * 0.5 : z.r) : raid.randomPointIn(a.pos.x, a.pos.z, 25);
    if (p) planPath(raid, a, p.x, p.z, 70);
    ai.idleUntil = raid.time + 4 + raid.rng() * 8;
  }
}

function pickMed(a) {
  const H = a.health;
  const items = allItems(a.inv, false).filter((it) => ITEMS[it.id].cat === 'med');
  const need = (f) => items.find((it) => f(ITEMS[it.id].med));
  if (Object.values(H.bleed).some((v) => v === 2)) { const m = need((m) => m.heavy); if (m) return m; }
  if (Object.values(H.bleed).some((v) => v === 1)) { const m = need((m) => m.bleed); if (m) return m; }
  if (Object.keys(H.fracture).length) { const m = need((m) => m.fracture); if (m) return m; }
  if (hpFrac(a) < 0.6) { const m = need((m) => m.heal > 0) || need((m) => m.stim?.regen); if (m) return m; }
  return null;
}

// レイダー：POI を巡って漁り、時間が来たら脱出
function thinkRaider(raid, a) {
  const ai = a.ai;
  if (ai.state === 'extract' || raid.time > ai.extractAt || bagFull(a) > 0.85 || raid.timeLeft < 120) {
    if (ai.state !== 'extract') { ai.state = 'extract'; ai.path = null; ai.exitGoal = null; }
    if (ai.pathFail > 4) {
      // 経路が見つからない：別の脱出地点を試し、少し移動して位置を変える
      (ai.badExits ||= new Set()).add(ai.exitGoal?.id);
      ai.exitGoal = null; ai.pathFail = 0;
      const p = raid.randomPointIn(a.pos.x, a.pos.z, 12);
      if (p) { ai.path = [p]; ai.pi = 0; }
      if (ai.badExits.size > 4) ai.badExits.clear();
      return;
    }
    if (!ai.exitGoal) {
      let best = null, bd = 1e9;
      for (const e of raid.extracts) {
        if (ai.badExits?.has(e.id)) continue;
        if (!e.open || (e.type !== 'always' && e.type !== 'random' && e.type !== 'switch')) continue;
        const d = Math.hypot(e.x - a.pos.x, e.z - a.pos.z);
        if (d < bd) { bd = d; best = e; }
      }
      ai.exitGoal = best;
    }
    if (ai.exitGoal && !ai.path) travel(raid, a, ai.exitGoal.x, ai.exitGoal.z);
    return;
  }
  // 漁り中
  if (ai.state === 'loot' && ai.lootTarget) {
    const ct = raid.containers.get(ai.lootTarget);
    if (!ct) { ai.lootTarget = null; ai.state = 'idle'; return; }
    const d = Math.hypot(ct.x - a.pos.x, ct.z - a.pos.z);
    if (d < 2.2) {
      ai.path = null;
      if (!ai.lootUntil) { ai.lootUntil = raid.time + 2.5 + raid.rng() * 3; raid.noise(a.pos, 6, a, 'loot'); }
      else if (raid.time > ai.lootUntil) {
        botLootContainer(raid, a, ct);
        ai.lootedSet.add(ct.id); ai.lootTarget = null; ai.lootUntil = 0; ai.state = 'idle';
      }
    } else if (!ai.path) {
      if (!planPath(raid, a, ct.x, ct.z, 60)) { ai.lootedSet.add(ct.id); ai.lootTarget = null; ai.state = 'idle'; }
    }
    return;
  }
  // 近くのコンテナを探す
  if (raid.time > ai.idleUntil) {
    let best = null, bd = 30;
    for (const ct of raid.containers.values()) {
      if (ai.lootedSet.has(ct.id)) continue;
      if (Math.abs(ct.y - a.pos.y) > 1.5) continue;
      const d = Math.hypot(ct.x - a.pos.x, ct.z - a.pos.z);
      if (d < bd && raid.world.walkable(ct.x + 0.9, ct.z) + raid.world.walkable(ct.x - 0.9, ct.z) + raid.world.walkable(ct.x, ct.z + 0.9) + raid.world.walkable(ct.x, ct.z - 0.9) > 0) { bd = d; best = ct; }
    }
    if (best && raid.rng() < 0.85) { ai.state = 'loot'; ai.lootTarget = best.id; ai.lootUntil = 0; ai.path = null; return; }
    // 次の POI へ
    if (!ai.path) {
      if (!ai.poiGoal || Math.hypot(ai.poiGoal.x - a.pos.x, ai.poiGoal.z - a.pos.z) < ai.poiGoal.r * 0.5) {
        if (ai.poiGoal) ai.poiVisited.add(ai.poiGoal.id);
        const opts = raid.map.pois.filter((p) => !ai.poiVisited.has(p.id));
        if (!opts.length) { ai.extractAt = raid.time; return; }
        ai.poiGoal = raid.rng.weighted(opts, (p) => (p.tier + 1) * (ai.tier === 'raider2' ? p.tier + 1 : 2) / (1 + Math.hypot(p.x - a.pos.x, p.z - a.pos.z) / 80));
      }
      const g = raid.randomPointIn(ai.poiGoal.x, ai.poiGoal.z, ai.poiGoal.r * 0.6) || ai.poiGoal;
      travel(raid, a, g.x, g.z);
    }
    ai.idleUntil = raid.time + 1.5;
  }
}

function bagFull(a) {
  let used = 0, cap = 0;
  for (const g of listGrids(a.inv)) {
    if (g.slot !== 'backpack') continue;
    cap += g.grid.w * g.grid.h;
    for (const it of g.grid.items) used += ITEMS[it.id].w * ITEMS[it.id].h;
  }
  return cap ? used / cap : 0;
}

function botLootContainer(raid, a, ct) {
  const root = raid.ensureContainer(ct);
  const items = [...root.grid.items].sort((p, q) => itemValue(q) / (ITEMS[q.id].w * ITEMS[q.id].h) - itemValue(p) / (ITEMS[p.id].w * ITEMS[p.id].h));
  let n = 0;
  for (const it of items) {
    if (n >= 3) break;
    if (itemValue(it) < 4000 && ITEMS[it.id].cat !== 'ammo' && ITEMS[it.id].cat !== 'med') continue;
    const idx = root.grid.items.indexOf(it);
    if (idx < 0) continue;
    root.grid.items.splice(idx, 1);
    if (autoInsert(a.inv, it)) n++;
    else { root.grid.items.push(it); }
  }
  if (!ct.looted) { ct.looted = true; raid.emit({ t: 'looted', id: ct.id }); }
  for (const c of raid.clients.values()) if (c.viewing?.root === ct.id) c.send({ t: 'lootUpd', root: ct.id, inv: JSON.parse(JSON.stringify(root)) });
}

// 長距離移動：途中のウェイポイントに分割
function travel(raid, a, x, z) {
  const d = Math.hypot(x - a.pos.x, z - a.pos.z);
  if (d < 90) return planPath(raid, a, x, z, 90);
  const t = 80 / d;
  const mx = a.pos.x + (x - a.pos.x) * t, mz = a.pos.z + (z - a.pos.z) * t;
  const p = raid.world.nearestWalkable(mx, mz, 12);
  if (p) return planPath(raid, a, p.x, p.z, 100);
  return false;
}

function planPath(raid, a, x, z, maxD = 80) {
  if (raid.pathBudget <= 0) return false;
  raid.pathBudget--;
  const nodes = Math.min(25000, 200 + maxD * maxD * 2.5);
  const p = raid.world.findPath(a.pos.x, a.pos.z, x, z, nodes);
  a.ai.path = p; a.ai.pi = 0;
  if (!p) { a.ai.pathFail++; return false; }
  a.ai.pathFail = 0;
  return true;
}

// ---------------------------------------------------------------- 機械
function thinkMachine(raid, a, M) {
  const ai = a.ai;
  const t = ai.target ? raid.actors.get(ai.target) : null;
  if (ai.state === 'combat') {
    if (!t || !t.alive) { ai.state = 'idle'; ai.target = null; return; }
    if (!ai.seen && raid.time - ai.lastSeenT > 4) { ai.state = 'search'; ai.searchUntil = raid.time + 12; ai.investigate = ai.lastSeen; ai.path = null; }
    if (!M.fly && (a.mtype === 'tick' || !ai.seen) && raid.time > (ai.repathT || 0)) {
      const tp = ai.seen ? t.pos : ai.lastSeen;
      if (tp) planPath(raid, a, tp.x, tp.z, 60);
      ai.repathT = raid.time + (a.mtype === 'tick' ? 0.8 : 3);
    }
    return;
  }
  if (ai.state === 'search') {
    if (raid.time > ai.searchUntil) { ai.state = 'idle'; ai.alerted = false; return; }
    if (ai.investigate && !M.fly && !ai.path) planPath(raid, a, ai.investigate.x, ai.investigate.z, 70);
    return;
  }
  if (raid.time > ai.idleUntil && !ai.path && !ai.flyGoal) {
    const z = ai.zone;
    const r = z?.roam ? z.r : z ? z.r : 30;
    const p = raid.randomPointIn(z ? z.x : a.pos.x, z ? z.z : a.pos.z, r);
    if (p) {
      if (M.fly) ai.flyGoal = p;
      else planPath(raid, a, p.x, p.z, 60);
    }
    ai.idleUntil = raid.time + 3 + raid.rng() * 6;
  }
}

// ---------------------------------------------------------------- 毎ティック更新（移動・照準・射撃）
export function aiUpdate(raid, a, dt) {
  if (a.kind === 'machine') return updateMachine(raid, a, dt);
  const ai = a.ai;
  if (a.flashUntil && raid.time < a.flashUntil) { a.moving = false; return; }
  const t = ai.target ? raid.actors.get(ai.target) : null;
  let speed = 0, mx = 0, mz = 0;
  let lookYaw = a.yaw, lookPitch = 0;
  const combat = ai.state === 'combat' && t;
  // パス追従
  if (ai.path && ai.pi < ai.path.length) {
    const wp = ai.path[ai.pi];
    const dx = wp.x - a.pos.x, dz = wp.z - a.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.6) { ai.pi++; if (ai.pi >= ai.path.length) ai.path = null; }
    else {
      mx = dx / d; mz = dz / d;
      speed = combat || ai.state === 'extract' || ai.state === 'search' ? 4.6 : 2.1;
      if (ai.state === 'search' && a.kind !== 'scav') speed = 2.8;
      if (!combat) lookYaw = Math.atan2(-mx, -mz);
    }
  }
  if (combat) {
    // 戦闘中：照準と横移動
    const e = eye(a), c = chest(t);
    if (ai.seen) {
      const head = raid.rng() < 0.02 + ai.skill * 0.06;
      const aim = head ? { x: t.pos.x, y: t.pos.y + humanHeight(t) - 0.12, z: t.pos.z } : c;
      lookYaw = yawTo(e, aim);
      const hd = Math.hypot(aim.x - e.x, aim.z - e.z);
      lookPitch = Math.atan2(aim.y - e.y, hd);
    } else if (ai.lastSeen) {
      lookYaw = yawTo(a.pos, ai.lastSeen);
    }
    ai.strafeT -= dt;
    if (ai.strafeT <= 0) { ai.strafe = raid.rng() < 0.5 ? 1 : -1; ai.strafeT = 0.8 + raid.rng() * 1.8; if (raid.rng() < 0.25) ai.strafe = 0; }
    if (!ai.path && ai.seen && ai.strafe && a.kind !== 'boss') {
      const r = { x: Math.cos(lookYaw), z: -Math.sin(lookYaw) };
      mx = r.x * ai.strafe; mz = r.z * ai.strafe;
      speed = ai.wantCrouch ? 1.2 : 2.4;
      // 壁に向かって進まない
      if (!raid.world.walkable(a.pos.x + mx * 1.2, a.pos.z + mz * 1.2)) { ai.strafe *= -1; mx = -mx; mz = -mz; }
    }
    a.crouch = ai.wantCrouch && !ai.path;
  } else a.crouch = false;
  if (a.w.useItem) speed = Math.min(speed, 1.2);
  speed *= moveFactor(a);
  // 旋回
  const turn = (combat ? 5 + ai.skill * 6 : 4) * dt;
  a.yaw += clamp(angleDiff(a.yaw, lookYaw), -turn, turn);
  a.pitch += clamp(lookPitch - a.pitch, -turn, turn);
  // 移動
  const wasX = a.pos.x, wasZ = a.pos.z;
  raid.world.moveCharacter(a.pos, mx * speed * dt, mz * speed * dt, dt, a.phys, 0.32, a.crouch ? 1.2 : 1.8);
  a.moving = speed > 0.1;
  a.sprint = speed > 4;
  if (a.moving && raid.time - (a.lastStepNoise || 0) > 0.7) { a.lastStepNoise = raid.time; raid.noise(a.pos, a.sprint ? 22 : 9, a, 'step'); }
  // スタック検出
  if (raid.time > ai.stuckCheck) {
    const moved = Math.hypot(a.pos.x - ai.lastP.x, a.pos.z - ai.lastP.z);
    if (ai.path && moved < 0.5) { ai.path = null; ai.idleUntil = 0; if (ai.lootTarget) { ai.lootedSet.add(ai.lootTarget); ai.lootTarget = null; ai.state = 'idle'; } }
    ai.lastP = { x: a.pos.x, z: a.pos.z }; ai.stuckCheck = raid.time + 2;
  }
  void wasX; void wasZ;
  // 射撃
  if (combat && ai.seen && !a.w.useItem) botShoot(raid, a, t, lookYaw, lookPitch);
}

function botShoot(raid, a, t, yaw, pitch) {
  const ai = a.ai;
  const w = a.inv.equip[a.slot];
  if (!w?.mag || w.mag.count <= 0 || raid.time < a.w.reloadUntil) return;
  const def = ITEMS[w.id], st = weaponStats(w);
  const dist = Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z);
  if (dist > RANGE[def.weapon.class] * 1.6) return;
  // 反応時間
  const react = 1.15 - ai.skill * 0.7;
  if (raid.time - ai.firstSeenT < react) return;
  if (raid.time < ai.pauseUntil) return;
  // 照準が合っているか
  const yerr = Math.abs(angleDiff(a.yaw, yaw));
  if (yerr > 0.12) return;
  if (raid.time < a.w.nextShot) return;
  // 照準誤差：時間とともに収束
  const onT = raid.time - ai.firstSeenT;
  const conv = Math.max(0.55 - ai.skill * 0.35, 1 - onT / (4.5 - ai.skill * 2.5));
  const base = (1.2 - ai.skill) * 0.06 * conv * (1 + dist / 50) * (t.moving ? (t.sprint ? 1.6 : 1.3) : 1) * (a.moving ? 1.4 : 1) * (t.crouch ? 0.9 : 1);
  const ex = (raid.rng() - 0.5) * 2 * base + ai.aimErrX * conv * 0.4;
  const ey = (raid.rng() - 0.5) * 2 * base * 0.7 + ai.aimErrY * conv * 0.4;
  const d = dirFromYawPitch(a.yaw + ex, a.pitch + ey);
  const o = eye(a);
  if (allyInLine(raid, a, o, t, dist)) { ai.pauseUntil = raid.time + 0.5; ai.strafeT = 0; return; }
  const auto = def.weapon.modes.includes('auto') && dist < 45;
  if (raid.fireWeapon(a, o, d)) {
    if (auto) {
      ai.burst++;
      if (ai.burst >= 3 + Math.floor(raid.rng() * 5)) { ai.burst = 0; ai.pauseUntil = raid.time + 0.25 + raid.rng() * 0.6; }
    } else {
      ai.pauseUntil = raid.time + (def.weapon.bolt || def.weapon.pump ? 0.9 : 0.18 + raid.rng() * 0.45 + dist / 300);
    }
  }
  void st;
}

// 射線上に味方がいるか
function allyInLine(raid, a, o, t, dist) {
  const dx = t.pos.x - o.x, dz = t.pos.z - o.z;
  const L = Math.hypot(dx, dz) || 1;
  for (const b of raid.actors.values()) {
    if (b === a || b === t || !b.alive || b.team !== a.team) continue;
    const bx = b.pos.x - o.x, bz = b.pos.z - o.z;
    const along = (bx * dx + bz * dz) / L;
    if (along < 0.5 || along > dist) continue;
    const perp = Math.abs(bx * dz - bz * dx) / L;
    if (perp < 0.9) return true;
  }
  return false;
}

function updateMachine(raid, a, dt) {
  const ai = a.ai, M = MACHINES[a.mtype];
  if (a.stunUntil && raid.time < a.stunUntil) { if (M.fly) a.pos.y -= dt * 1.5; return; }
  const t = ai.target ? raid.actors.get(ai.target) : null;
  const combat = ai.state === 'combat' && t;
  let lookYaw = a.yaw, lookPitch = 0;
  ai.hover += dt;
  if (M.fly) {
    // 飛行：目標地点へ直線移動＋障害物回避
    let goal = ai.flyGoal;
    let alt = M.fly;
    if (combat) {
      const d = Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z);
      const want = a.mtype === 'hornet' ? 28 : 18;
      const ang = Math.atan2(a.pos.z - t.pos.z, a.pos.x - t.pos.x) + dt * 0.5 * (ai.strafe || 1);
      const rr = d > want + 6 ? d - 4 : d < want - 6 ? d + 4 : want;
      goal = { x: t.pos.x + Math.cos(ang) * rr, z: t.pos.z + Math.sin(ang) * rr };
      alt = M.fly + 1;
      lookYaw = yawTo(a.pos, t.pos);
      const c = chest(t);
      lookPitch = Math.atan2(c.y - a.pos.y, Math.max(1, d));
    } else if (ai.state === 'search' && ai.investigate) goal = ai.investigate;
    const gy = raid.world.groundAt(a.pos.x, a.pos.z, a.pos.y + 1, 0.4, 30);
    const ty = gy + alt + Math.sin(ai.hover * 1.7) * 0.4;
    if (goal) {
      const dx = goal.x - a.pos.x, dz = goal.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < 2 && !combat) { ai.flyGoal = null; }
      else {
        const sp = (combat ? M.speed : M.speed * 0.5) * dt;
        const dir = { x: dx / d, y: 0, z: dz / d };
        const hit = raid.world.raycast(a.pos, dir, 3);
        if (hit && hit.t < 2.5) { a.pos.y += 4 * dt; if (a.pos.y > gy + 16) ai.flyGoal = null; }
        else { a.pos.x += dir.x * Math.min(sp, d); a.pos.z += dir.z * Math.min(sp, d); }
        if (!combat) lookYaw = Math.atan2(-dir.x, -dir.z);
      }
    }
    a.pos.y += clamp(ty - a.pos.y, -3 * dt, 3 * dt);
    a.moving = true;
  } else {
    // 地上：パス追従
    let speed = 0, mx = 0, mz = 0;
    if (ai.path && ai.pi < ai.path.length) {
      const wp = ai.path[ai.pi];
      const dx = wp.x - a.pos.x, dz = wp.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.8) { ai.pi++; if (ai.pi >= ai.path.length) ai.path = null; }
      else { mx = dx / d; mz = dz / d; speed = combat ? M.speed : M.speed * 0.5; lookYaw = Math.atan2(-mx, -mz); }
    }
    if (a.mtype === 'sentinel') {
      if (combat && ai.seen) { speed = 0; }
      if (a.mhp.leg <= 0) speed *= 0.4;
    }
    if (combat && ai.seen) {
      lookYaw = yawTo(a.pos, t.pos);
      const e = eye(a), c = chest(t);
      lookPitch = Math.atan2(c.y - e.y, Math.max(1, Math.hypot(c.x - e.x, c.z - e.z)));
    }
    raid.world.moveCharacter(a.pos, mx * speed * dt, mz * speed * dt, dt, a.phys, a.mtype === 'sentinel' ? 0.7 : 0.4, a.mtype === 'sentinel' ? 3.5 : 0.9, a.mtype === 'sentinel' ? 0.6 : 0.45);
    a.moving = speed > 0.1;
  }
  const turn = M.turn * dt;
  a.yaw += clamp(angleDiff(a.yaw, lookYaw), -turn, turn);
  a.pitch += clamp(lookPitch - a.pitch, -turn, turn);
  // 攻撃
  if (!combat || !ai.seen) { a.w.charge = 0; return; }
  const dist = Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z);
  if (M.explode) {
    if (dist < M.explode.trigger || ai.armed) {
      if (!ai.armed) { ai.armed = raid.time + 0.7; raid.emit({ t: 'tickArm', id: a.id }); }
      if (raid.time > ai.armed) { a.exploded = true; raid.explode({ x: a.pos.x, y: a.pos.y + 0.5, z: a.pos.z }, M.explode.radius, M.explode.dmg, a, 'frag'); raid.kill(a, null, '自爆'); }
    }
    return;
  }
  const W = M.weapon;
  if (dist > W.range) return;
  if (Math.abs(angleDiff(a.yaw, lookYaw)) > 0.25) return;
  if (raid.time < ai.pauseUntil) return;
  if (raid.time - ai.firstSeenT < 0.8) return;
  if (W.charge) {
    if (!a.w.charge) { a.w.charge = raid.time; raid.emit({ t: 'charge', id: a.id, dur: W.charge, target: t.id }); return; }
    if (raid.time - a.w.charge < W.charge) return;
    a.w.charge = 0;
  }
  if (raid.time < a.w.nextShot) return;
  a.w.nextShot = raid.time + 60 / W.rpm;
  const e = eye(a);
  const sp = W.spread * Math.PI / 180 * (1 + dist / 80);
  const d = dirFromYawPitch(a.yaw + (raid.rng() - 0.5) * sp * 2, a.pitch + (raid.rng() - 0.5) * sp * 1.4);
  const r = raid.traceShot(a, e, d, { damage: W.dmg, pen: W.pen, armorDmg: 0.45 }, 1, { weapon: M.name });
  raid.emit({ t: 'shot', id: a.id, o: [e.x, e.y, e.z], e: [[r.end.x, r.end.y, r.end.z, r.kind, r.n ? [r.n.x, r.n.y, r.n.z] : null]], cal: 'machine', cls: a.mtype, msnd: W.sound, mtr: W.tracer, beam: !!W.beam });
  raid.noise(e, 120, a, 'shot');
  ai.burst++;
  if (ai.burst >= W.burst) { ai.burst = 0; ai.pauseUntil = raid.time + W.pause * (0.7 + raid.rng() * 0.6); }
}

// ---------------------------------------------------------------- 外部イベント
export function aiOnDamage(raid, a, attacker) {
  const ai = a.ai;
  if (!attacker || attacker === a || !raid.hostile(a, attacker)) return;
  ai.alerted = true;
  ai.detect[attacker.id] = 1.5;
  if (ai.state !== 'combat' || !ai.seen) {
    ai.target = attacker.id;
    ai.lastSeen = { x: attacker.pos.x, y: attacker.pos.y, z: attacker.pos.z };
    ai.lastSeenT = raid.time;
    ai.firstSeenT = raid.time + 0.3;
    ai.state = 'combat';
    ai.path = null;
    // 振り向く
    if (a.kind !== 'machine') a.yaw += angleDiff(a.yaw, yawTo(a.pos, attacker.pos)) * 0.6;
    alertAllies(raid, a, attacker);
  }
}

function leashed(a) { return a.kind !== 'raider' && a.ai.zone; }
function outOfLeash(a, p, extra = 50) {
  const z = a.ai.zone;
  if (!z || a.kind === 'raider') return false;
  return Math.hypot(p.x - z.x, p.z - z.z) > z.r + extra;
}

export function aiOnNoise(raid, a, p, src, kind, frac) {
  const ai = a.ai;
  if (ai.state === 'combat') return;
  if (outOfLeash(a, p, a.kind === 'machine' ? 35 : 45)) return;
  if (a.kind === 'raider' && Math.hypot(p.x - a.pos.x, p.z - a.pos.z) > 90) return;
  if (src && !raid.hostile(a, src)) return;
  if (kind === 'step' && frac > 0.7) return;
  if (kind === 'step' && raid.rng() > 0.5) return;
  if (ai.state === 'extract' && kind !== 'shot') return;
  ai.investigate = { x: p.x + (raid.rng() - 0.5) * 6 * frac, z: p.z + (raid.rng() - 0.5) * 6 * frac };
  if (kind === 'shot' || kind === 'boom') ai.alerted = true;
  if (ai.state !== 'search') { ai.state = 'search'; ai.searchUntil = raid.time + 10 + raid.rng() * 12; ai.path = null; }
  // 振り向き
  if (kind !== 'step' || frac < 0.4) a.yaw += angleDiff(a.yaw, yawTo(a.pos, p)) * 0.5;
  if (a.kind === 'machine' && MACHINES[a.mtype].fly) ai.flyGoal = { x: p.x, z: p.z };
}

void findItem; void removeItem;
