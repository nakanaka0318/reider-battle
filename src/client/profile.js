// プレイヤープロフィール（ローカル保存）：倉庫・装備・所持金・トレーダー・クラフト・クエスト
import { ITEMS, ITEM_LIST, createItem, itemValue, EQUIP_SLOTS } from '../shared/items.js';
import { newGrid, newActorInv, autoInsert, findItem, removeItem, allItems, listGrids } from '../shared/inventory.js';
import { TRADERS, RECIPES, STATIONS, QUESTS, traderBuyRate, traderMaxRarity, levelFromXp } from '../shared/data/meta.js';

const KEY = 'raider-battle-profile-v1';
export const STASH_W = 10, STASH_BASE_ROWS = 30;
export const CRAFT_SPEED = 0.25; // レシピ秒数 × これ = 実時間秒

let P = null;
const listeners = new Set();
export function onProfileChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function changed() { save(); for (const fn of listeners) fn(P); }

export function profile() { return P; }

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { P = JSON.parse(raw); migrate(P); return P; }
  } catch (e) { console.warn('profile load failed', e); }
  P = null;
  return null;
}
export function save() {
  if (!P) return;
  try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { console.warn('save failed', e); }
}
export function resetProfile() { try { localStorage.removeItem(KEY); } catch { /* noop */ } P = null; }

function migrate(p) {
  p.settings ||= defaultSettings();
  p.settings = { ...defaultSettings(), ...p.settings };
  p.hideout ||= { workbench: 1, medstation: 1, kitchen: 0, tailor: 0, server: 0, arc_lab: 0, stash: 0 };
  p.crafts ||= [];
  p.quests ||= {};
  p.stats ||= {};
  p.health ||= { energy: 100, hydration: 100 };
  p.history ||= [];
}

function defaultSettings() {
  return { sens: 1.0, fov: 75, volume: 0.8, music: 0.4, quality: 'high', invertY: false, serverUrl: '', showFps: false, adsSensMul: 0.75 };
}

export function stashRows(p = P) {
  const lvl = p.hideout.stash || 0;
  let rows = STASH_BASE_ROWS;
  for (let i = 0; i < lvl; i++) rows += STATIONS.stash.rows[i];
  return rows;
}

export function newProfile(name) {
  const loadout = newActorInv();
  const e = loadout.equip;
  e.primary = createItem('ak74n', { ammoId: 'a545_ps' });
  e.holster = createItem('p17', { ammoId: 'a9_pst' });
  e.armor = createItem('ar_paca');
  e.rig = createItem('rig_scav');
  e.backpack = createItem('bp_duffle');
  e.secure = createItem('sc_alpha');
  autoInsert(loadout, createItem('a545_ps', { count: 60 }));
  autoInsert(loadout, createItem('a545_ps', { count: 30 }));
  autoInsert(loadout, createItem('a9_pst', { count: 34 }));
  autoInsert(loadout, createItem('bandage'));
  autoInsert(loadout, createItem('medkit_ai2'));
  autoInsert(loadout, createItem('water'));
  autoInsert(loadout, createItem('gr_rgd5'));
  const stash = { grid: newGrid(STASH_W, STASH_BASE_ROWS) };
  const give = (id, opts) => autoInsert(stash, createItem(id, opts));
  give('mp133'); give('a12_buck', { count: 20 }); give('a12_buck', { count: 20 }); give('a12_slug', { count: 10 });
  give('akm', { ammoId: 'a762_ps' }); give('a762_ps', { count: 60 }); give('a762_ps', { count: 60 });
  give('m1911'); give('a45_fmj', { count: 40 });
  give('ar_6b2'); give('hm_ssh68'); give('bp_day'); give('rig_bank');
  give('medkit_car'); give('medkit_salewa'); give('splint'); give('painkiller'); give('bandage'); give('tourniquet');
  give('can_beef'); give('crackers'); give('juice'); give('water');
  give('gr_f1'); give('gr_smoke');
  give('sight_rd1'); give('grip_vert'); give('mz_hider'); give('tac_light');
  give('duct_tape'); give('bolts', { count: 6 }); give('gunpowder_pack');
  P = {
    version: 1, name: name || 'レイダー', created: Date.now(), xp: 0, money: 250000,
    loadout, stash, settings: defaultSettings(), hideout: { workbench: 1, medstation: 1, kitchen: 0, tailor: 0, server: 0, arc_lab: 0, stash: 0 },
    crafts: [], quests: {}, stats: { raids: 0, survived: 0, deaths: 0, mia: 0, kills: 0, pmcKills: 0, scavKills: 0, machineKills: 0, bossKills: 0, lootValue: 0, totalEarned: 0 },
    health: { energy: 100, hydration: 100 }, history: [],
  };
  changed();
  return P;
}

export function level(p = P) { return levelFromXp(p.xp); }

// ---------------------------------------------------------------- ルート参照
export function roots() { return { stash: P.stash, loadout: P.loadout }; }
export function commit() { changed(); }

// ---------------------------------------------------------------- 売買
export function sellPrice(item, trader) {
  const def = ITEMS[item.id];
  const rate = traderBuyRate(trader, def);
  if (!rate) return 0;
  return Math.max(1, Math.floor(itemValue(item) * rate));
}
export function bestTraderFor(item) {
  let best = null, bp = 0;
  for (const t of TRADERS) { const p = sellPrice(item, t); if (p > bp) { bp = p; best = t; } }
  return { trader: best, price: bp };
}
export function sellItem(rootName, uid, trader) {
  const root = rootName === 'stash' ? P.stash : P.loadout;
  const f = findItem(root, uid);
  if (!f) return 0;
  const price = sellPrice(f.item, trader);
  if (!price) return 0;
  removeItem(root, uid);
  P.money += price;
  P.stats.totalEarned = (P.stats.totalEarned || 0) + price;
  changed();
  return price;
}
export function buyPack(def) { return def.cat === 'ammo' ? Math.min(def.stack, 60) : 1; }
export function buyPrice(def) {
  const n = buyPack(def);
  return Math.round(def.value * n * 1.28);
}
export function traderStock(trader) {
  const maxR = traderMaxRarity(level());
  return ITEM_LIST.filter((d) => {
    if (d.cat === 'money' || d.cat === 'secure') return trader.sells.includes('secure_small') && d.id === 'sc_alpha';
    if (d.loot?.includes('machine') && d.cat !== 'grenade') return false;
    if (d.rarity > maxR || d.rarity >= 5) return false;
    if (d.cat === 'key') return trader.sells.includes('key') && d.sub === 'key' && d.rarity <= 2;
    return trader.sells.includes(d.cat);
  }).sort((a, b) => (a.cat < b.cat ? -1 : a.cat > b.cat ? 1 : a.value - b.value));
}
export function buyItem(def) {
  const price = buyPrice(def);
  if (P.money < price) return { ok: false, msg: 'クレジットが足りない' };
  const it = createItem(def.id, { count: buyPack(def) });
  if (!autoInsert(P.stash, it)) return { ok: false, msg: '倉庫に空きがない' };
  P.money -= price;
  changed();
  return { ok: true };
}

// 倉庫内のクレジットを入金
export function depositCredits() {
  let total = 0;
  for (const root of [P.stash, P.loadout]) {
    for (const it of allItems(root, true)) {
      if (it.id === 'credits') { total += it.count; removeItem(root, it.uid); }
    }
  }
  P.money += total;
  return total;
}

// ---------------------------------------------------------------- 所持数（倉庫内）
export function countInStash(id, firOnly = false) {
  let n = 0;
  for (const it of allItems(P.stash, true)) if (it.id === id && (!firOnly || it.fir)) n += ITEMS[id].stack > 1 ? it.count : 1;
  return n;
}
export function takeFromStash(id, n, firOnly = false) {
  let left = n;
  const items = allItems(P.stash, true).filter((it) => it.id === id && (!firOnly || it.fir));
  for (const it of items) {
    if (left <= 0) break;
    const def = ITEMS[id];
    if (def.stack > 1) {
      const k = Math.min(left, it.count);
      it.count -= k; left -= k;
      if (it.count <= 0) removeItem(P.stash, it.uid);
    } else { removeItem(P.stash, it.uid); left--; }
  }
  return n - left;
}

// ---------------------------------------------------------------- ハイドアウト
export function stationLevel(id) { return P.hideout[id] || 0; }
export function upgradeCost(id) {
  const S = STATIONS[id];
  const lvl = stationLevel(id);
  if (lvl >= S.money.length) return null;
  return { money: S.money[lvl], items: S.costs[lvl] || [] };
}
export function canUpgrade(id) {
  const c = upgradeCost(id);
  if (!c) return false;
  if (P.money < c.money) return false;
  return c.items.every(([iid, n]) => countInStash(iid) >= n);
}
export function upgradeStation(id) {
  if (!canUpgrade(id)) return false;
  const c = upgradeCost(id);
  P.money -= c.money;
  for (const [iid, n] of c.items) takeFromStash(iid, n);
  P.hideout[id] = stationLevel(id) + 1;
  if (id === 'stash') P.stash.grid.h = stashRows();
  changed();
  return true;
}
export function recipesFor(station) { return RECIPES.filter((r) => r.station === station); }
export function canCraft(r) {
  if (stationLevel(r.station) < r.lvl) return false;
  if (P.crafts.some((c) => c.station === r.station)) return false;
  return r.in.every(([id, n]) => countInStash(id) >= n);
}
export function startCraft(r) {
  if (!canCraft(r)) return false;
  for (const [id, n] of r.in) if (!(r.keep || []).includes(id)) takeFromStash(id, n);
  P.crafts.push({ recipe: r.id, station: r.station, start: Date.now(), end: Date.now() + r.time * CRAFT_SPEED * 1000 });
  changed();
  return true;
}
export function craftDone(c) { return Date.now() >= c.end; }
export function skipCraftCost(c) { return Math.max(0, Math.ceil((c.end - Date.now()) / 1000) * 60); }
export function skipCraft(c) {
  const cost = skipCraftCost(c);
  if (P.money < cost) return false;
  P.money -= cost; c.end = Date.now();
  changed();
  return true;
}
export function collectCraft(c) {
  if (!craftDone(c)) return false;
  const r = RECIPES.find((x) => x.id === c.recipe);
  for (const [id, n] of r.out) {
    const def = ITEMS[id];
    let left = n;
    while (left > 0) {
      const k = def.stack > 1 ? Math.min(def.stack, left) : 1;
      const it = createItem(id, { count: k, fir: true });
      it.fir = true;
      if (!autoInsert(P.stash, it)) return false;
      left -= k;
    }
  }
  P.crafts.splice(P.crafts.indexOf(c), 1);
  changed();
  return true;
}

// ---------------------------------------------------------------- クエスト
export function questState(q) { return P.quests[q.id]?.state || (q.req ? (q.req.every((r) => P.quests[r]?.state === 'done') ? 'available' : 'locked') : 'available'); }
export function acceptQuest(q) {
  if (questState(q) !== 'available') return;
  P.quests[q.id] = { state: 'active', progress: q.obj.map(() => 0) };
  changed();
}
export function objProgress(q, i) {
  const st = P.quests[q.id];
  const o = q.obj[i];
  if (o.type === 'find') return Math.min(o.count, countInStash(o.item, true));
  return st?.progress?.[i] || 0;
}
export function questComplete(q) { return q.obj.every((o, i) => objProgress(q, i) >= o.count); }
export function turnInQuest(q) {
  const st = P.quests[q.id];
  if (!st || st.state !== 'active' || !questComplete(q)) return false;
  q.obj.forEach((o) => { if (o.type === 'find') takeFromStash(o.item, o.count, true); });
  st.state = 'done';
  const r = q.reward;
  P.money += r.money || 0;
  P.xp += r.xp || 0;
  for (const [id, n] of r.items || []) {
    const def = ITEMS[id];
    autoInsert(P.stash, createItem(id, { count: def.stack > 1 ? n : 1 }));
    if (def.stack <= 1) for (let k = 1; k < n; k++) autoInsert(P.stash, createItem(id));
  }
  if (r.unlockStation && !stationLevel(r.unlockStation)) P.hideout[r.unlockStation] = 1;
  changed();
  return true;
}
function questEvent(type, data) {
  for (const q of QUESTS) {
    const st = P.quests[q.id];
    if (!st || st.state !== 'active') continue;
    q.obj.forEach((o, i) => {
      if (o.type !== type) return;
      if (type === 'kill' && (o.target === data.kind)) st.progress[i] = Math.min(o.count, (st.progress[i] || 0) + 1);
      if (type === 'extract' && o.ex === data.ex) st.progress[i] = Math.min(o.count, (st.progress[i] || 0) + 1);
      if (type === 'survive') st.progress[i] = Math.min(o.count, (st.progress[i] || 0) + 1);
      if (type === 'loot_value' && data.value >= o.count) st.progress[i] = o.count;
    });
  }
}

// ---------------------------------------------------------------- レイド結果の反映
export function prepareRaidLoadout() {
  return JSON.parse(JSON.stringify(P.loadout));
}

export function applyRaidResult(res) {
  // res: { survived, mia, inv, secure, stats, exId, exName, health }
  const s = P.stats;
  s.raids = (s.raids || 0) + 1;
  const st = res.stats || {};
  let xp = 0;
  const before = itemsValue(P.loadout);
  let gained = 0;
  if (res.survived) {
    s.survived = (s.survived || 0) + 1;
    P.loadout = res.inv;
    // FIR 以外の印を整理
    for (const it of allItems(P.loadout)) if (it.fir === undefined) delete it.fir;
    gained = itemsValue(P.loadout) - before;
    xp += 600 + Math.max(0, gained) / 120;
    questEvent('survive', {});
    if (res.exId) questEvent('extract', { ex: res.exId });
    questEvent('loot_value', { value: gained });
  } else {
    if (res.mia) s.mia = (s.mia || 0) + 1; else s.deaths = (s.deaths || 0) + 1;
    const lo = newActorInv();
    if (res.secure) lo.equip.secure = res.secure;
    else if (P.loadout.equip.secure) lo.equip.secure = P.loadout.equip.secure;
    P.loadout = lo;
    gained = -before;
    xp += 150;
  }
  if (res.health) { P.health.energy = Math.max(30, res.health.energy); P.health.hydration = Math.max(30, res.health.hydration); }
  for (const k of st.killList || []) {
    const kind = k === 'raider' || k === 'player' ? 'raider' : k === 'boss' ? 'boss' : k === 'scav' || k === 'guard' ? 'scav' : 'machine';
    questEvent('kill', { kind });
    if (['wasp', 'hornet', 'tick', 'sentinel'].includes(k)) questEvent('kill', { kind: k });
    xp += kind === 'raider' ? 500 : kind === 'boss' ? 2500 : kind === 'scav' ? 150 : k === 'sentinel' ? 1500 : 250;
  }
  s.kills = (s.kills || 0) + (st.kills || 0);
  s.pmcKills = (s.pmcKills || 0) + (st.pmcKills || 0);
  s.scavKills = (s.scavKills || 0) + (st.scavKills || 0);
  s.machineKills = (s.machineKills || 0) + (st.machineKills || 0);
  s.bossKills = (s.bossKills || 0) + (st.bossKills || 0);
  s.lootValue = (s.lootValue || 0) + Math.max(0, gained);
  const lvBefore = level();
  P.xp += Math.round(xp);
  const deposited = res.survived ? depositCredits() : 0;
  const entry = { t: Date.now(), survived: !!res.survived, mia: !!res.mia, ex: res.exName || null, killer: res.killer || null, kills: st.kills || 0, gained, xp: Math.round(xp), deposited };
  P.history.unshift(entry);
  P.history = P.history.slice(0, 30);
  changed();
  return { ...entry, levelUp: level() > lvBefore };
}

export function itemsValue(root) {
  let v = 0;
  if (root.equip) for (const s of EQUIP_SLOTS) if (root.equip[s]) v += itemValue(root.equip[s]);
  for (const g of [root.pockets, root.grid]) if (g) for (const it of g.items) v += itemValue(it);
  return v;
}

export function stashValue() { return itemsValue(P.stash) + itemsValue(P.loadout); }
export { listGrids };
