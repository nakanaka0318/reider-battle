// ダメージモデル：部位HP、防具、出血・骨折（Tarkov 風）
import { ITEMS } from './items.js';

export const PARTS = ['head', 'thorax', 'stomach', 'armL', 'armR', 'legL', 'legR'];
export const PART_NAMES = { head: '頭部', thorax: '胸部', stomach: '腹部', armL: '左腕', armR: '右腕', legL: '左脚', legR: '右脚' };
export const PART_HP = { head: 35, thorax: 85, stomach: 70, armL: 60, armR: 60, legL: 65, legR: 65 };
export const TOTAL_HP = Object.values(PART_HP).reduce((a, b) => a + b, 0);
const MAT_DESTRUCT = { aramid: 0.25, uhmwpe: 0.45, steel: 0.7, titan: 0.55, ceramic: 0.8 };

export function newHealth() {
  const hp = {};
  for (const p of PARTS) hp[p] = PART_HP[p];
  return { hp, bleed: {}, fracture: {}, destroyed: {}, pain: 0, energy: 100, hydration: 100, stims: [] };
}

// 人型の当たり判定（垂直円柱）
export const HUMAN_R = 0.3;
export function humanHeight(a) { return a.crouch ? 1.2 : 1.8; }

export function rayCylinder(o, d, cx, cz, y0, y1, r, maxT) {
  const ox = o.x - cx, oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  let tHit = null;
  if (a > 1e-9) {
    const b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const t0 = (-b - s) / (2 * a), t1 = (-b + s) / (2 * a);
    for (const t of [t0, t1]) {
      if (t < 0 || t > maxT) continue;
      const y = o.y + d.y * t;
      if (y >= y0 && y <= y1) { tHit = t; break; }
    }
  }
  // 上面
  if (tHit === null && Math.abs(d.y) > 1e-6) {
    const t = (y1 - o.y) / d.y;
    if (t >= 0 && t <= maxT) {
      const x = ox + d.x * t, z = oz + d.z * t;
      if (x * x + z * z <= r * r) tHit = t;
    }
  }
  return tHit;
}

export function raySphere(o, d, c, r, maxT) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t < 0 || t > maxT) return null;
  return t;
}

// 命中点から部位判定
export function humanZone(a, hp) {
  const h = humanHeight(a);
  const rel = (hp.y - a.pos.y) / h;
  const rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
  const lat = (hp.x - a.pos.x) * rx + (hp.z - a.pos.z) * rz;
  if (rel > 0.85) return 'head';
  if (rel > 0.6) return Math.abs(lat) > 0.19 ? (lat > 0 ? 'armR' : 'armL') : 'thorax';
  if (rel > 0.47) return Math.abs(lat) > 0.22 ? (lat > 0 ? 'armR' : 'armL') : 'stomach';
  return lat > 0 ? 'legR' : 'legL';
}

// 防具アイテムの取得
export function armorFor(inv, zone) {
  const out = [];
  if (!inv?.equip) return out;
  const e = inv.equip;
  for (const it of [e.helmet, e.armor, e.rig]) {
    if (!it) continue;
    const def = ITEMS[it.id];
    if (def.armor && def.armor.zones.includes(zone) && it.dur > 0) out.push({ it, def });
  }
  return out;
}

// 人間へのダメージ。戻り値 { dmg, zone, blocked, armorHit, killed, bleed, fracture }
export function damageHuman(a, zone, ammo, rng, opts = {}) {
  const H = a.health;
  let dmg = ammo.damage * (opts.dmgMul || 1);
  let pen = ammo.pen;
  let blocked = false, armorHit = null;
  if (!opts.explosive) {
    for (const { it, def } of armorFor(a.inv, zone)) {
      const ar = def.armor;
      const durFrac = it.dur / ar.dur;
      const prot = ar.cls * 10;
      const effProt = prot * (0.55 + 0.45 * durFrac);
      // 跳弾（ヘルメット）
      if (zone === 'head' && ar.ricochet && rng() < ar.ricochet * 0.3 && pen < prot + 10) {
        it.dur = Math.max(0, it.dur - pen * 0.1);
        return { dmg: 0, zone, blocked: true, armorHit: def.name, ricochet: true, killed: false };
      }
      const pChance = Math.max(0.02, Math.min(0.98, 0.5 + (pen - effProt) / 18));
      const md = MAT_DESTRUCT[ar.mat] ?? 0.5;
      const armorDmg = Math.max(0.5, pen * (ammo.armorDmg ?? 0.5) * md * 0.6);
      it.dur = Math.max(0, it.dur - armorDmg);
      armorHit = def.name;
      if (rng() < pChance) {
        dmg *= 1 - 0.25 * (ar.cls / 6);
        pen *= 0.8;
      } else {
        blocked = true;
        dmg = dmg * (zone === 'head' ? 0.12 : 0.2) * (1 - durFrac * 0.4);
        break;
      }
    }
  }
  // フラグメント
  if (!blocked && ammo.frag && rng() < ammo.frag * 0.4) dmg *= 1.5;
  // イージー：受けるダメージ 1/4、出血・骨折なし
  if (a.easy) dmg *= 0.25;
  const res = applyPartDamage(a, zone, dmg, rng);
  res.blocked = blocked; res.armorHit = armorHit;
  // 出血・骨折
  if (!blocked && H && dmg > 12 && !opts.noBleed && !a.easy) {
    const isLimb = zone !== 'head';
    if (isLimb && rng() < 0.12 + dmg / 400) { H.bleed[zone] = 2; res.bleed = 2; }
    else if (isLimb && rng() < 0.3 + dmg / 300) { H.bleed[zone] = Math.max(H.bleed[zone] || 0, 1); res.bleed = 1; }
  }
  if (H && !a.easy && (zone.startsWith('leg') || zone.startsWith('arm')) && dmg > 25 && rng() < 0.18 + (opts.explosive ? 0.2 : 0)) {
    H.fracture[zone] = true; res.fracture = true;
  }
  return res;
}

export function applyPartDamage(a, zone, dmg, rng) {
  const H = a.health;
  let killed = false;
  // イージー：手足は HP 1 で止まり欠損しない（あふれた分は他の部位へ）
  if (a.easy && zone !== 'head' && zone !== 'thorax') {
    const keep = Math.min(H.hp[zone], 1);
    const take = Math.min(dmg, Math.max(0, H.hp[zone] - keep));
    H.hp[zone] -= take;
    if (dmg > take) spreadEasy(H, zone, (dmg - take) * (zone.startsWith('arm') ? 0.7 : 0.8));
    if (H.hp.head <= 0 || H.hp.thorax <= 0) killed = true;
    return { dmg, zone, killed };
  }
  if (H.hp[zone] > 0) {
    const before = H.hp[zone];
    H.hp[zone] = Math.max(0, before - dmg);
    const overflow = dmg - before;
    if (H.hp[zone] <= 0) {
      if (zone === 'head' || zone === 'thorax') killed = true;
      else H.destroyed[zone] = true;
      if (overflow > 0 && !killed) spread(H, zone, overflow * 0.8);
    }
  } else {
    if (zone === 'head' || zone === 'thorax') killed = true;
    else spread(H, zone, dmg * (zone.startsWith('arm') ? 0.7 : 1));
  }
  if (H.hp.head <= 0 || H.hp.thorax <= 0) killed = true;
  void rng;
  return { dmg, zone, killed };
}

// イージー用：手足は 1 未満にしない。受けきれない分は胸部へ
function spreadEasy(H, from, dmg) {
  const floor = (p) => (p === 'head' || p === 'thorax' ? 0 : 1);
  const alive = PARTS.filter((p) => p !== from && H.hp[p] > floor(p));
  if (!alive.length) { H.hp.thorax = Math.max(0, H.hp.thorax - dmg); return; }
  const each = dmg / alive.length;
  let rest = 0;
  for (const p of alive) {
    const t = Math.min(each, H.hp[p] - floor(p));
    H.hp[p] -= t; rest += each - t;
  }
  if (rest > 0.01) H.hp.thorax = Math.max(0, H.hp.thorax - rest);
}

function spread(H, from, dmg) {
  const alive = PARTS.filter((p) => p !== from && H.hp[p] > 0);
  if (!alive.length) { H.hp.thorax = 0; return; }
  const each = dmg / alive.length;
  for (const p of alive) H.hp[p] = Math.max(0, H.hp[p] - each);
}

export function totalHp(H) {
  let s = 0;
  for (const p of PARTS) s += H.hp[p];
  return s;
}

// 継続処理（出血・脱水など）。戻り値 true で死亡
export function tickHealth(a, dt) {
  const H = a.health;
  let dead = false;
  for (const [p, lvl] of Object.entries(H.bleed)) {
    if (!lvl) continue;
    const r = lvl === 2 ? 2.6 : 0.75;
    const res = applyPartDamage(a, p, r * dt);
    if (res.killed) dead = true;
  }
  H.energy = Math.max(0, H.energy - 0.03 * dt);
  H.hydration = Math.max(0, H.hydration - 0.045 * dt);
  if (H.energy <= 0) { if (applyPartDamage(a, 'stomach', 0.25 * dt).killed) dead = true; }
  if (H.hydration <= 0) { if (applyPartDamage(a, 'thorax', 0.25 * dt).killed) dead = true; }
  if (H.pain > 0) H.pain = Math.max(0, H.pain - dt);
  for (let i = H.stims.length - 1; i >= 0; i--) {
    const s = H.stims[i];
    s.t -= dt;
    if (s.regen) healDistribute(H, s.regen * dt);
    if (s.t <= 0) H.stims.splice(i, 1);
  }
  return dead;
}

export function healDistribute(H, amount) {
  // 損傷の大きい部位から回復（破壊部位は回復不可）
  let left = amount;
  for (let k = 0; k < 7 && left > 0.001; k++) {
    let worst = null, wv = 0;
    for (const p of PARTS) {
      if (H.destroyed[p]) continue;
      const miss = PART_HP[p] - H.hp[p];
      if (miss > wv) { wv = miss; worst = p; }
    }
    if (!worst) break;
    const h = Math.min(left, wv);
    H.hp[worst] += h; left -= h;
  }
  return amount - left;
}

export function stimValue(H, key) {
  let v = 0;
  for (const s of H.stims) if (s[key]) v = Math.max(v, s[key]);
  return v;
}

// 医薬品・食料の効果適用。戻り値：消費したか
export function applyMed(a, item) {
  const def = ITEMS[item.id];
  const m = def.med;
  const H = a.health;
  let used = false;
  if (m.heavy) { for (const p of PARTS) if (H.bleed[p] === 2) { delete H.bleed[p]; used = true; if (!m.bleed) break; } }
  if (m.bleed) { for (const p of PARTS) if (H.bleed[p] === 1) { delete H.bleed[p]; used = true; } }
  if (m.fracture) { for (const p of PARTS) if (H.fracture[p]) { delete H.fracture[p]; used = true; break; } }
  if (m.restore) {
    for (const p of PARTS) if (H.destroyed[p]) { delete H.destroyed[p]; H.hp[p] = 1; delete H.bleed[p]; used = true; break; }
  }
  if (m.heal) {
    const healed = healDistribute(H, m.heal);
    if (healed > 0) used = true;
  }
  if (m.pain) { H.pain = Math.max(H.pain, m.pain); used = true; }
  if (m.stim) { H.stims.push({ ...m.stim, t: m.stim.dur }); used = true; }
  if (m.energy) { H.energy = Math.max(0, Math.min(100, H.energy + m.energy)); used = true; }
  if (m.hydration) { H.hydration = Math.max(0, Math.min(100, H.hydration + m.hydration)); used = true; }
  return used;
}

// 移動速度係数
export function moveFactor(a) {
  const H = a.health;
  if (!H) return 1;
  let f = 1;
  const legBad = (H.fracture.legL || H.fracture.legR || H.destroyed.legL || H.destroyed.legR);
  if (legBad && H.pain <= 0) f *= 0.6;
  f *= 1 + stimValue(H, 'speed');
  return f;
}
