// プレイヤープロフィール（ローカル保存）：倉庫・装備・所持金・トレーダー・クラフト・クエスト
import { ITEMS, ITEM_LIST, createItem, itemValue, EQUIP_SLOTS, slotAccepts, weaponStats } from '../shared/items.js';
import { newGrid, newActorInv, autoInsert, findItem, removeItem, allItems, listGrids, canEquip, countAmmo } from '../shared/inventory.js';
import { TRADERS, RECIPES, STATIONS, QUESTS, traderBuyRate, traderMaxRarity, levelFromXp } from '../shared/data/meta.js';

const KEY = 'raider-battle-profile-v1';
export const STASH_W = 10, STASH_BASE_ROWS = 30;
export const CRAFT_SPEED = 0.25; // レシピ秒数 × これ = 実時間秒

let P = null;
const listeners = new Set();
export function onProfileChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function changed() { save(); for (const fn of listeners) fn(P); }

export function profile() { return P; }

// ---------------------------------------------------------------- 複数プレイヤー（セーブスロット）
const INDEX = 'rb-profiles-v1', CUR = 'rb-current-v1';
const slotKey = (id) => 'rb-profile-' + id;
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { console.warn('save failed', e); return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch { /* noop */ } }
function readIndex() { try { return JSON.parse(lsGet(INDEX) || '[]'); } catch { return []; } }
function writeIndex(list) { lsSet(INDEX, JSON.stringify(list)); }
function newId() { return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }

// 旧形式（1 人分）のセーブを 1 つ目のスロットへ移す
function migrateLegacy() {
  const raw = lsGet(KEY);
  if (!raw) return;
  try {
    const p = JSON.parse(raw);
    p.id = p.id || newId();
    lsSet(slotKey(p.id), JSON.stringify(p));
    const list = readIndex();
    if (!list.some((e) => e.id === p.id)) list.push(summary(p));
    writeIndex(list);
    if (!lsGet(CUR)) lsSet(CUR, p.id);
    lsDel(KEY);
  } catch (e) { console.warn('legacy migrate failed', e); }
}
function summary(p) { return { id: p.id, name: p.name, level: levelFromXp(p.xp || 0), money: p.money || 0, raids: p.stats?.raids || 0, updated: Date.now() }; }

export function listProfiles() { migrateLegacy(); return readIndex().sort((a, b) => b.updated - a.updated); }
export function currentId() { return P?.id || lsGet(CUR); }

export function loadProfile(id) {
  migrateLegacy();
  id = id || lsGet(CUR);
  P = null;
  if (!id) return null;
  try {
    const raw = lsGet(slotKey(id));
    if (raw) { P = JSON.parse(raw); P.id = id; migrate(P); lsSet(CUR, id); return P; }
  } catch (e) { console.warn('profile load failed', e); }
  return null;
}
export function save() {
  if (!P) return;
  if (!P.id) P.id = newId();
  lsSet(slotKey(P.id), JSON.stringify(P));
  lsSet(CUR, P.id);
  const list = readIndex().filter((e) => e.id !== P.id);
  list.push(summary(P));
  writeIndex(list);
}
export function switchProfile(id) { save(); return loadProfile(id); }
export function deleteProfile(id) {
  lsDel(slotKey(id));
  writeIndex(readIndex().filter((e) => e.id !== id));
  if (lsGet(CUR) === id) lsDel(CUR);
  if (P?.id === id) P = null;
}
// 現在のプレイヤーを消して最初から（スロットごと削除）
export function resetProfile() { if (P?.id) deleteProfile(P.id); else lsDel(CUR); P = null; }

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
  const touch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  return { sens: 1.0, fov: touch ? 70 : 75, volume: 0.8, music: 0.4, quality: touch ? 'medium' : 'high', invertY: false, serverUrl: '', showFps: false, adsSensMul: 0.75, touchSens: 1.0, aimAssist: touch ? 2 : 0, autoFire: false, footsteps: 0.3 };
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
  const prevSettings = P?.settings;
  P = {
    id: newId(), version: 1, name: name || 'レイダー', created: Date.now(), xp: 0, money: 250000,
    loadout, stash, settings: defaultSettings(), hideout: { workbench: 1, medstation: 1, kitchen: 0, tailor: 0, server: 0, arc_lab: 0, stash: 0 },
    crafts: [], quests: {}, stats: { raids: 0, survived: 0, deaths: 0, mia: 0, kills: 0, pmcKills: 0, scavKills: 0, machineKills: 0, bossKills: 0, lootValue: 0, totalEarned: 0 },
    health: { energy: 100, hydration: 100 }, history: [],
  };
  if (prevSettings) P.settings = { ...P.settings, ...prevSettings }; // 操作設定は引き継ぐ
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

// ---------------------------------------------------------------- おまかせ装備
// mode: 'fill'（空きスロットだけ埋める） | 'best'（倉庫により良い物があれば入れ替える）
function gearScore(slot, it) {
  const d = ITEMS[it.id];
  if (d.weapon) return itemValue(it) + (it.mag?.count ? 1 : 0);
  if (d.armor && (slot === 'armor' || slot === 'helmet')) return d.armor.cls * 1000 + (it.dur ?? d.armor.dur) * 4 - d.armor.speed * 300;
  if (slot === 'rig') return (d.grids || []).reduce((s, [w, h]) => s + w * h, 0) * 10 + (d.armor ? d.armor.cls * 400 : 0);
  if (d.grids) return d.grids.reduce((s, [w, h]) => s + w * h, 0);
  return itemValue(it);
}

export function autoEquip(mode = 'fill') {
  const lo = P.loadout, st = P.stash;
  const log = [];
  const order = ['primary', 'holster', 'secondary', 'rig', 'armor', 'helmet', 'backpack', 'secure'];
  for (const slot of order) {
    const cur = lo.equip[slot];
    if (cur && mode === 'fill') continue;
    let best = null, bs = cur ? gearScore(slot, cur) : -1;
    for (const it of st.grid.items) {
      if (!slotAccepts(slot, ITEMS[it.id])) continue;
      if (slot === 'secondary' && lo.equip.primary && ITEMS[it.id].weapon.class === ITEMS[lo.equip.primary.id].weapon.class) continue;
      // 現在の装備を外した前提で装着可能か（リグとアーマーの排他）
      const tmp = { equip: { ...lo.equip, [slot]: null } };
      if (!canEquip(tmp, slot, it)) continue;
      const sc = gearScore(slot, it);
      if (sc > bs) { bs = sc; best = it; }
    }
    if (!best) continue;
    st.grid.items.splice(st.grid.items.indexOf(best), 1);
    delete best.x; delete best.y; best.rot = false;
    if (cur) {
      lo.equip[slot] = null;
      // 外した装備の中身ごと倉庫へ（入らなければ元に戻す）
      if (!autoInsert(st, cur)) { lo.equip[slot] = cur; autoInsert(st, best); continue; }
    }
    lo.equip[slot] = best;
    log.push(`${ITEMS[best.id].name}`);
  }
  // 武器に弾を込める（倉庫・装備内で最も貫通力の高い弾）
  for (const s of ['primary', 'secondary', 'holster']) {
    const w = lo.equip[s];
    if (!w?.mag) continue;
    const cal = ITEMS[w.id].weapon.caliber, cap = weaponStats(w).capacity;
    if (w.mag.count >= cap) continue;
    const avail = { ...countAmmo({ equip: {}, pockets: st.grid }, cal) };
    let ammoId = w.mag.count > 0 ? w.mag.ammo : null;
    if (!ammoId) for (const id of Object.keys(avail)) if (!ammoId || ITEMS[id].ammo.pen > ITEMS[ammoId].ammo.pen) ammoId = id;
    if (!ammoId || !avail[ammoId]) continue;
    w.mag.ammo = ammoId;
    w.mag.count += takeFromStash(ammoId, cap - w.mag.count);
    log.push(`${ITEMS[w.id].short} に装填`);
  }
  // 予備弾薬（各武器 2 マガジン分）
  for (const s of ['primary', 'secondary', 'holster']) {
    const w = lo.equip[s];
    if (!w?.mag) continue;
    const def = ITEMS[w.id], cap = weaponStats(w).capacity;
    const want = Math.min(def.weapon.class === 'pistol' ? cap : cap * 2, 120);
    const have = Object.values(countAmmo(lo, def.weapon.caliber)).reduce((a, b) => a + b, 0);
    let need = want - have, moved = 0;
    while (need > 0) {
      const inStash = Object.keys(countAmmo({ equip: {}, pockets: st.grid }, def.weapon.caliber));
      const id = inStash.includes(w.mag.ammo) ? w.mag.ammo : inStash[0];
      if (!id) break;
      const n = takeFromStash(id, Math.min(need, ITEMS[id].stack));
      if (!n) break;
      const a = createItem(id, { count: n });
      if (!autoInsert(lo, a)) { autoInsert(st, a); break; }
      need -= n; moved += n;
    }
    if (moved) log.push(`予備弾 ${ITEMS[w.id].short}×${moved}`);
  }
  // 医薬品・食料・投擲物（足りない役割だけ）
  const loItems = () => allItems(lo).map((i) => ITEMS[i.id]);
  const roles = [
    ['止血', (d) => d.med && d.med.bleed && !d.med.heal],
    ['止血帯', (d) => d.med && d.med.heavy],
    ['回復', (d) => d.med && d.med.heal > 0],
    ['骨折', (d) => d.med && d.med.fracture],
    ['鎮痛', (d) => d.med && d.med.pain && !d.med.heal],
    ['水分', (d) => d.cat === 'food' && d.med.hydration > 20],
    ['投擲物', (d) => d.cat === 'grenade' && d.grenade.type === 'frag'],
  ];
  for (const [name, f] of roles) {
    if (loItems().some(f)) continue;
    const cand = st.grid.items.filter((i) => f(ITEMS[i.id])).sort((a, b) => itemValue(a) - itemValue(b))[0];
    if (!cand) continue;
    st.grid.items.splice(st.grid.items.indexOf(cand), 1);
    if (autoInsert(lo, cand)) log.push(name);
    else autoInsert(st, cand);
  }
  changed();
  return log;
}

// ---------------------------------------------------------------- 自動購入して編成
// 倉庫の物で埋めたあと、空いているスロットと足りない補給品をトレーダーから予算内で買って装備する
export function autoBuyLoadout(budget) {
  budget = Math.min(budget, P.money);
  const startMoney = P.money;
  const bought = [];
  autoEquip('fill');
  const stock = new Map();
  for (const t of TRADERS) for (const d of traderStock(t)) stock.set(d.id, d);
  const defs = [...stock.values()];
  const buy = (d) => { const r = buyItem(d); if (r.ok) bought.push(d.name); return r.ok; };
  const lo = P.loadout;
  // スロットごとの予算配分
  const W = { primary: 34, armor: 20, helmet: 9, rig: 8, backpack: 7, holster: 5 };
  const empty = Object.keys(W).filter((s) => !lo.equip[s]);
  const reserve = Math.round(budget * 0.18); // 弾薬と医薬品用
  const tot = empty.reduce((s, k) => s + W[k], 0) || 1;
  let carry = 0;
  const ammoCost = (wd) => {
    const a = defs.filter((d) => d.cat === 'ammo' && d.ammo.caliber === wd.weapon.caliber).sort((x, y) => buyPrice(x) - buyPrice(y))[0];
    return a ? buyPrice(a) * Math.ceil((wd.weapon.mag * 3) / buyPack(a)) : Infinity;
  };
  const pickers = {
    primary: (d) => d.cat === 'weapon' && d.weapon.class !== 'pistol' && d.weapon.caliber !== 'arc' && ammoCost(d) < Infinity,
    holster: (d) => d.cat === 'weapon' && d.weapon.class === 'pistol' && ammoCost(d) < Infinity,
    armor: (d) => d.cat === 'armor' && !(lo.equip.rig && ITEMS[lo.equip.rig.id].armor),
    helmet: (d) => d.cat === 'helmet',
    rig: (d) => d.cat === 'rig' && !d.armor,
    backpack: (d) => d.cat === 'backpack',
  };
  const score = (slot, d) => {
    if (d.weapon) return d.value;
    if (d.armor) return d.armor.cls * 1000 + d.armor.dur - d.weight * 10;
    return (d.grids || []).reduce((s, [w, h]) => s + w * h, 0) * 100 - d.value / 1000;
  };
  for (const slot of ['primary', 'armor', 'helmet', 'rig', 'backpack', 'holster']) {
    if (!empty.includes(slot)) continue;
    const allot = Math.floor((budget - reserve) * W[slot] / tot) + carry;
    const extra = (d) => (d.weapon ? ammoCost(d) : 0);
    let cands = defs.filter(pickers[slot]).filter((d) => buyPrice(d) + extra(d) <= allot && buyPrice(d) <= P.money);
    cands.sort((a, b) => score(slot, b) - score(slot, a));
    let d = cands[0];
    // 武器が 1 つもないときは、予算の範囲で一番安い武器（ピストル含む）を必ず買う
    if (!d && slot === 'primary' && !lo.equip.holster && !lo.equip.secondary) {
      cands = defs.filter((x) => x.cat === 'weapon' && x.weapon.caliber !== 'arc' && ammoCost(x) < Infinity && buyPrice(x) + ammoCost(x) <= Math.min(budget, P.money));
      cands.sort((a, b) => buyPrice(a) - buyPrice(b));
      d = cands[0];
    }
    // 武器は弾薬代を残しておく（弾は後でまとめて買う）
    if (d && buy(d)) carry = allot - buyPrice(d) - extra(d);
    else carry = allot;
    carry = Math.max(0, carry);
    autoEquip('fill');
  }
  // 弾薬：装填分＋予備 2 マガジン分を確保
  const spentSoFar = () => startMoney - P.money;
  for (const s of ['primary', 'secondary', 'holster']) {
    const w = lo.equip[s];
    if (!w?.mag) continue;
    const wd = ITEMS[w.id];
    const want = weaponStats(w).capacity * 3;
    const have = (w.mag.count || 0) + Object.values(countAmmo(lo, wd.weapon.caliber)).reduce((a, b) => a + b, 0) + Object.values(countAmmo({ equip: {}, pockets: P.stash.grid }, wd.weapon.caliber)).reduce((a, b) => a + b, 0);
    let need = want - have;
    const ammos = defs.filter((d) => d.cat === 'ammo' && d.ammo.caliber === wd.weapon.caliber);
    // 予算に余裕があれば貫通力の高い弾
    ammos.sort((a, b) => b.ammo.pen - a.ammo.pen);
    const room = budget - spentSoFar();
    const a = ammos.find((d) => buyPrice(d) * Math.ceil(Math.max(need, 1) / buyPack(d)) <= room * 0.6) || ammos[ammos.length - 1];
    while (need > 0 && a && buyPrice(a) <= P.money && spentSoFar() + buyPrice(a) <= budget) { if (!buy(a)) break; need -= buyPack(a); }
  }
  // 医薬品・水（持っていない役割だけ、安い物）
  const all = () => [...allItems(lo), ...allItems(P.stash)].map((i) => ITEMS[i.id]);
  const roles = [
    (d) => d.cat === 'med' && d.med.bleed && !d.med.heal,
    (d) => d.cat === 'med' && d.med.heavy,
    (d) => d.cat === 'med' && d.med.heal > 0,
    (d) => d.cat === 'med' && d.med.fracture,
    (d) => d.cat === 'med' && d.med.pain && !d.med.heal,
    (d) => d.cat === 'food' && d.med.hydration > 20,
  ];
  for (const f of roles) {
    if (all().some(f)) continue;
    const d = defs.filter(f).sort((a, b) => buyPrice(a) - buyPrice(b))[0];
    if (d && spentSoFar() + buyPrice(d) <= budget) buy(d);
  }
  const log = autoEquip('fill');
  changed();
  return { spent: startMoney - P.money, bought, log };
}
