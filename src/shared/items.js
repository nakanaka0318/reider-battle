// アイテム定義の統合・インデックス・生成
import { CORE_ITEMS, CALIBERS } from './data/items_core.js';
import { MISC_ITEMS } from './data/items_misc.js';
import { uid } from './math.js';

export { CALIBERS };

export const ITEMS = {};
export const ITEM_LIST = [];
for (const it of [...CORE_ITEMS, ...MISC_ITEMS]) {
  if (ITEMS[it.id]) { console.warn('duplicate item id', it.id); continue; }
  it.rarity = it.rarity ?? 0;
  it.stack = it.stack || 1;
  it.loot = it.loot || [];
  ITEMS[it.id] = it;
  ITEM_LIST.push(it);
}

export const CAT_NAMES = {
  weapon: '武器', ammo: '弾薬', mod: 'MOD', armor: 'ボディアーマー', helmet: 'ヘルメット', rig: 'リグ',
  backpack: 'バックパック', secure: 'セキュアコンテナ', med: '医薬品', food: '食料', grenade: '投擲物',
  key: '鍵', barter: 'バーター', valuable: '貴重品', machine: '機械パーツ', intel: '情報', money: '通貨',
};
export const RARITY_NAMES = ['コモン', 'アンコモン', 'レア', 'エピック', 'レジェンダリー', 'エキゾチック'];
export const RARITY_COLORS = ['#8a8f94', '#5fae5a', '#3f8fd8', '#a45ad8', '#e0a030', '#e04848'];
export const SLOT_NAMES = {
  primary: 'メイン武器', secondary: 'サブ武器', holster: 'ホルスター', helmet: 'ヘルメット', armor: 'アーマー',
  rig: 'リグ', backpack: 'バックパック', secure: 'セキュア',
};
export const EQUIP_SLOTS = ['primary', 'secondary', 'holster', 'helmet', 'armor', 'rig', 'backpack', 'secure'];

export function slotAccepts(slot, def) {
  if (!def) return false;
  switch (slot) {
    case 'primary': case 'secondary': return def.cat === 'weapon' && def.weapon.class !== 'pistol';
    case 'holster': return def.cat === 'weapon' && def.weapon.class === 'pistol';
    case 'helmet': return def.cat === 'helmet';
    case 'armor': return def.cat === 'armor';
    case 'rig': return def.cat === 'rig';
    case 'backpack': return def.cat === 'backpack';
    case 'secure': return def.cat === 'secure';
  }
  return false;
}

export function modFits(weaponDef, modDef) {
  if (!weaponDef?.weapon || modDef?.cat !== 'mod') return false;
  const m = modDef.mod, w = weaponDef.weapon;
  if (!w.slots.includes(m.slot)) return false;
  if (m.fits && !m.fits.includes(w.class)) return false;
  if (m.calibers && !m.calibers.includes(w.caliber)) return false;
  if (w.class === 'pistol' && m.slot === 'sight' && m.zoom > 1.5) return false;
  return true;
}

// アイテムインスタンスの生成
export function createItem(id, opts = {}) {
  const def = ITEMS[id];
  if (!def) throw new Error('unknown item ' + id);
  const it = { uid: uid(), id, count: 1 };
  if (def.stack > 1) it.count = Math.min(def.stack, opts.count ?? 1);
  if (def.armor) it.dur = opts.dur ?? def.armor.dur;
  if (def.grids) it.grids = def.grids.map(([w, h]) => ({ w, h, items: [] }));
  if (def.weapon) {
    it.mods = {};
    if (opts.mods) for (const [slot, mid] of Object.entries(opts.mods)) if (mid && ITEMS[mid]) it.mods[slot] = createItem(mid);
    const ammoId = opts.ammoId || def.weapon.defaultAmmo;
    it.mag = { ammo: ammoId, count: opts.loaded ?? weaponCapacity(it) };
    it.chamber = true;
  }
  if (def.med) it.uses = def.med.uses;
  if (opts.fir) it.fir = true;
  return it;
}

export function weaponCapacity(item) {
  const def = ITEMS[item.id];
  let cap = def.weapon.mag;
  const m = item.mods?.mag;
  if (m) cap += ITEMS[m.id].mod.magBonus;
  return cap;
}

// 武器の実効ステータス（MOD込み）
export function weaponStats(item) {
  const def = ITEMS[item.id];
  const w = def.weapon;
  let recoilMul = 1, ergo = w.ergo, spreadMul = 1, zoom = w.zoom, suppressed = w.suppressed;
  let reticle = null, light = false, laser = false, thermal = false, nv = false, sightZoom = 0;
  for (const m of Object.values(item.mods || {})) {
    if (!m) continue;
    const md = ITEMS[m.id].mod;
    recoilMul *= 1 - md.recoil;
    ergo += md.ergo;
    spreadMul *= 1 + md.spread;
    if (md.suppressor) suppressed = true;
    if (md.slot === 'sight') { sightZoom = md.zoom; reticle = md.reticle; thermal = md.thermal; nv = md.nv; }
    if (md.light) light = true;
    if (md.laser) laser = true;
  }
  if (sightZoom) zoom = sightZoom;
  return {
    ...w, recoilV: w.recoilV * recoilMul, recoilH: w.recoilH * recoilMul, ergo: Math.max(10, Math.min(100, ergo)),
    spread: w.spread * Math.max(0.3, spreadMul), zoom, suppressed, reticle, light, laser, thermal, nv,
    capacity: weaponCapacity(item), hipSpread: (laser ? 0.6 : 1) * (w.class === 'shotgun' ? 2.2 : w.class === 'pistol' ? 1.6 : 2.4),
  };
}

export function itemValue(item) {
  const def = ITEMS[item.id];
  if (!def) return 0;
  let v = def.valuePerUnit ? def.value * (item.count || 1) : def.value;
  if (def.armor && item.dur != null) v *= 0.35 + 0.65 * (item.dur / def.armor.dur);
  if (def.med && def.med.uses > 1 && item.uses != null) v *= item.uses / def.med.uses;
  if (item.mods) for (const m of Object.values(item.mods)) if (m) v += itemValue(m);
  if (item.mag && item.mag.count > 0 && ITEMS[item.mag.ammo]) v += ITEMS[item.mag.ammo].value * item.mag.count;
  if (item.grids) for (const g of item.grids) for (const c of g.items) v += itemValue(c);
  return Math.round(v);
}

export function itemWeight(item) {
  const def = ITEMS[item.id];
  if (!def) return 0;
  let w = def.weight * (def.stack > 1 ? item.count : 1);
  if (item.mods) for (const m of Object.values(item.mods)) if (m) w += itemWeight(m);
  if (item.grids) for (const g of item.grids) for (const c of g.items) w += itemWeight(c);
  return w;
}

// ---------------------------------------------------------------- ルート
export const LOOT_TAGS = ['industrial', 'tech', 'medical', 'residential', 'office', 'military', 'food', 'valuable', 'machine', 'junk'];
const RARITY_W = [100, 42, 16, 5, 1.6, 0.45];
const byTag = {};
for (const t of LOOT_TAGS) byTag[t] = [];
for (const it of ITEM_LIST) {
  if (it.noLoot) continue;
  for (const t of it.loot) if (byTag[t]) byTag[t].push(it);
}

// コンテナ種別
export const CONTAINERS = {
  crate: { name: '木箱', grid: [4, 4], count: [2, 5], tags: { industrial: 4, junk: 3, building: 0, tech: 1, food: 1 }, model: 'crate' },
  toolbox: { name: '工具箱', grid: [4, 3], count: [1, 4], tags: { industrial: 6, tech: 2, junk: 1 }, model: 'toolbox' },
  weapon_box: { name: '武器ケース', grid: [5, 3], count: [1, 3], tags: { military: 1 }, cats: ['weapon', 'mod', 'ammo'], bias: 1.4, model: 'weaponbox' },
  ammo_box: { name: '弾薬箱', grid: [3, 3], count: [2, 4], tags: { military: 1 }, cats: ['ammo', 'grenade'], model: 'ammobox' },
  military_crate: { name: '軍用コンテナ', grid: [5, 5], count: [2, 4], tags: { military: 1 }, cats: ['armor', 'helmet', 'rig', 'backpack', 'grenade', 'mod', 'ammo', 'med', 'weapon'], bias: 1.2, model: 'milcrate' },
  med_case: { name: '医療ケース', grid: [4, 3], count: [2, 5], tags: { medical: 1 }, model: 'medcase' },
  filing: { name: 'ファイルキャビネット', grid: [3, 4], count: [1, 4], tags: { office: 5, valuable: 0.4, tech: 1 }, cats: ['barter', 'intel', 'key', 'money', 'valuable'], model: 'filing' },
  pc: { name: 'PC本体', grid: [2, 2], count: [1, 2], tags: { tech: 1 }, cats: ['barter', 'intel'], model: 'pc' },
  safe: { name: '金庫', grid: [3, 3], count: [2, 4], tags: { valuable: 4, office: 1 }, cats: ['valuable', 'money', 'intel', 'key'], bias: 1.6, model: 'safe' },
  jacket: { name: 'ジャケット', grid: [2, 2], count: [0, 2], tags: { residential: 2, office: 1, junk: 1 }, cats: ['key', 'money', 'barter', 'med', 'food'], model: 'jacket' },
  duffel: { name: 'ダッフルバッグ', grid: [4, 3], count: [1, 4], tags: { residential: 2, military: 1, industrial: 1, medical: 1, food: 1 }, model: 'duffel' },
  fridge: { name: '冷蔵庫', grid: [3, 4], count: [1, 4], tags: { food: 1 }, model: 'fridge' },
  locker: { name: 'ロッカー', grid: [3, 5], count: [1, 3], tags: { residential: 2, military: 2, industrial: 1 }, cats: ['armor', 'helmet', 'rig', 'backpack', 'barter', 'med', 'weapon', 'ammo', 'key', 'food'], model: 'locker' },
  register: { name: 'レジ', grid: [2, 2], count: [1, 2], tags: { office: 1 }, cats: ['money', 'valuable', 'key'], model: 'register' },
  drawer: { name: '引き出し', grid: [3, 2], count: [1, 3], tags: { residential: 3, office: 2, medical: 1, valuable: 0.3 }, cats: ['barter', 'key', 'money', 'med', 'food', 'valuable', 'ammo', 'intel'], model: 'drawer' },
  arc_cache: { name: 'ARCキャッシュ', grid: [4, 4], count: [2, 4], tags: { machine: 4, tech: 2 }, bias: 1.3, model: 'arccache' },
  lab_case: { name: '研究用ケース', grid: [4, 4], count: [2, 4], tags: { tech: 3, medical: 2, valuable: 1, machine: 1 }, bias: 1.8, model: 'labcase' },
  supply_drop: { name: '補給物資', grid: [6, 5], count: [4, 7], tags: { military: 3, medical: 1, valuable: 1 }, bias: 2.0, model: 'airdrop' },
};

// 価格に応じたアイテム選択（bias が高いほどレアが出やすい）
export function pickLootItem(rng, tags, cats, bias = 1) {
  const tagList = Object.entries(tags).filter(([t, w]) => w > 0 && byTag[t]?.length);
  if (!tagList.length) return null;
  for (let tries = 0; tries < 12; tries++) {
    const [tag] = rng.weighted(tagList, (e) => e[1]);
    let pool = byTag[tag];
    if (cats) pool = pool.filter((i) => cats.includes(i.cat));
    if (!pool.length) continue;
    return rng.weighted(pool, (i) => RARITY_W[i.rarity] * Math.pow(bias, i.rarity));
  }
  return null;
}

export function lootInstance(rng, def, fir = true) {
  const opts = { fir };
  if (def.cat === 'ammo') opts.count = Math.max(1, Math.round(def.stack * rng.range(0.2, 1)));
  if (def.cat === 'money') opts.count = Math.round(rng.range(400, 18000) / 50) * 50;
  if (def.stack > 1 && def.cat !== 'ammo' && def.cat !== 'money') opts.count = rng.int(1, Math.max(1, Math.floor(def.stack / 3)));
  if (def.armor) opts.dur = Math.round(def.armor.dur * rng.range(0.35, 1));
  if (def.weapon) {
    opts.loaded = rng.chance(0.5) ? 0 : rng.int(0, def.weapon.mag);
    if (rng.chance(0.35)) {
      const sights = ITEM_LIST.filter((m) => m.cat === 'mod' && m.mod.slot === 'sight' && modFits(def, m) && m.rarity <= 2);
      if (sights.length) opts.mods = { sight: rng.pick(sights).id };
    }
  }
  const it = createItem(def.id, opts);
  if (def.med && def.med.uses > 1) it.uses = rng.int(1, def.med.uses);
  return it;
}

export function itemsByCat(cat) { return ITEM_LIST.filter((i) => i.cat === cat); }
export function ammoForCaliber(cal) { return ITEM_LIST.filter((i) => i.cat === 'ammo' && i.ammo.caliber === cal); }
