// グリッドインベントリ（Tarkov 風）。ルートは actor / box / stash の 3 種類。
// actor: { equip: {slot: item|null}, pockets: grid }
// box:   { grid }
// stash: { grid }
// grid:  { w, h, items: [item(x,y,rot)] }
import { ITEMS, EQUIP_SLOTS, slotAccepts, itemWeight } from './items.js';

export function newGrid(w, h) { return { w, h, items: [] }; }
export function newActorInv() {
  const equip = {};
  for (const s of EQUIP_SLOTS) equip[s] = null;
  return { equip, pockets: newGrid(4, 1) };
}

export function dims(item, rot = item.rot) {
  const d = ITEMS[item.id];
  return rot ? [d.h, d.w] : [d.w, d.h];
}

// ルート内の全グリッドを列挙（gid 付き）
export function listGrids(root, out = []) {
  if (root.pockets) out.push({ gid: 'pockets', grid: root.pockets });
  if (root.grid) out.push({ gid: 'main', grid: root.grid });
  if (root.equip) {
    for (const s of EQUIP_SLOTS) {
      const it = root.equip[s];
      if (it?.grids) it.grids.forEach((g, i) => out.push({ gid: it.uid + ':' + i, grid: g, slot: s, owner: it }));
    }
  }
  // グリッド内のコンテナアイテム（スタッシュ内のバックパック等）
  const n = out.length;
  for (let k = 0; k < n; k++) collectNested(out[k].grid, out);
  return out;
}
function collectNested(grid, out) {
  for (const it of grid.items) {
    if (it.grids) it.grids.forEach((g, i) => { out.push({ gid: it.uid + ':' + i, grid: g, owner: it }); collectNested(g, out); });
  }
}

export function findGrid(root, gid) {
  return listGrids(root).find((g) => g.gid === gid)?.grid || null;
}

// アイテム検索：{ item, grid?, slot?, modOf? }
export function findItem(root, uid) {
  if (root.equip) {
    for (const s of EQUIP_SLOTS) {
      const it = root.equip[s];
      if (!it) continue;
      if (it.uid === uid) return { item: it, slot: s };
      const r = findInItem(it, uid);
      if (r) return r;
    }
  }
  for (const g of [root.pockets, root.grid]) {
    if (!g) continue;
    const r = findInGrid(g, uid);
    if (r) return r;
  }
  return null;
}
function findInGrid(grid, uid) {
  for (const it of grid.items) {
    if (it.uid === uid) return { item: it, grid };
    const r = findInItem(it, uid);
    if (r) return r;
  }
  return null;
}
function findInItem(it, uid) {
  if (it.mods) for (const [slot, m] of Object.entries(it.mods)) if (m && m.uid === uid) return { item: m, modOf: it, modSlot: slot };
  if (it.grids) for (const g of it.grids) { const r = findInGrid(g, uid); if (r) return r; }
  return null;
}

export function isDescendant(container, uid) {
  if (!container.grids) return false;
  for (const g of container.grids) for (const it of g.items) {
    if (it.uid === uid || isDescendant(it, uid)) return true;
  }
  return false;
}

export function canPlace(grid, item, x, y, rot, ignoreUid = null) {
  const [w, h] = dims(item, rot);
  if (x < 0 || y < 0 || x + w > grid.w || y + h > grid.h) return false;
  for (const o of grid.items) {
    if (o.uid === ignoreUid || o.uid === item.uid) continue;
    const [ow, oh] = dims(o);
    if (x < o.x + ow && x + w > o.x && y < o.y + oh && y + h > o.y) return false;
  }
  return true;
}

export function findSpace(grid, item) {
  const d = ITEMS[item.id];
  const rots = d.w === d.h ? [false] : [false, true];
  for (const rot of rots) {
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
      if (canPlace(grid, item, x, y, rot)) return { x, y, rot };
    }
  }
  return null;
}

export function removeItem(root, uid) {
  const f = findItem(root, uid);
  if (!f) return null;
  if (f.slot) root.equip[f.slot] = null;
  else if (f.grid) f.grid.items.splice(f.grid.items.indexOf(f.item), 1);
  else if (f.modOf) delete f.modOf.mods[f.modSlot];
  return f.item;
}

// 既存スタックへ統合。残数を返す
export function mergeIntoGrids(grids, item) {
  const def = ITEMS[item.id];
  if (def.stack <= 1) return item.count;
  for (const g of grids) for (const o of g.items) {
    if (o.id === item.id && o.uid !== item.uid && o.count < def.stack) {
      const n = Math.min(def.stack - o.count, item.count);
      o.count += n; item.count -= n;
      if (o.fir === undefined || !item.fir) o.fir = o.fir && item.fir;
      if (item.count <= 0) return 0;
    }
  }
  return item.count;
}

// 自動格納（スタック → 空き）。成功時 true
export function autoInsert(root, item, opts = {}) {
  let grids = listGrids(root).filter((g) => !g.owner || !isSecureOwner(g.owner) || opts.allowSecure);
  if (opts.order) grids.sort((a, b) => opts.order(a) - opts.order(b));
  if (mergeIntoGrids(grids.map((g) => g.grid), item) <= 0) return true;
  for (const g of grids) {
    if (g.owner && (g.owner.uid === item.uid || isDescendant(item, g.owner.uid))) continue;
    if (item.grids && g.owner && !canNestContainer(item)) continue;
    const sp = findSpace(g.grid, item);
    if (sp) { item.x = sp.x; item.y = sp.y; item.rot = sp.rot; g.grid.items.push(item); return true; }
  }
  return false;
}
function isSecureOwner(it) { return ITEMS[it.id]?.cat === 'secure'; }

// 中身入りのバックパック・リグは他のコンテナに入れられない（スタッシュ直下は可）
export function canNestContainer(item) {
  if (!item.grids) return true;
  return item.grids.every((g) => g.items.length === 0);
}

// 装備スロットに装着（入れ替えは呼び出し側で）
export function canEquip(root, slot, item) {
  if (!root.equip) return false;
  const def = ITEMS[item.id];
  if (!slotAccepts(slot, def)) return false;
  // アーマーリグとボディアーマーの排他
  if (slot === 'armor' && root.equip.rig && ITEMS[root.equip.rig.id].armor) return false;
  if (slot === 'rig' && def.armor && root.equip.armor) return false;
  return true;
}

// 汎用移動。target: { gid, x, y, rot } | { slot } | { merge: uid } | { mod: weaponUid, slot }
// 成功時 true。失敗時は何も変更しない。
export function moveItem(srcRoot, uid, dstRoot, target) {
  const f = findItem(srcRoot, uid);
  if (!f) return false;
  const item = f.item;
  if (target.merge) {
    const t = findItem(dstRoot, target.merge);
    if (!t || t.item.id !== item.id || t.item.uid === item.uid) return false;
    const def = ITEMS[item.id];
    if (def.stack <= 1) return false;
    const n = Math.min(def.stack - t.item.count, item.count);
    if (n <= 0) return false;
    t.item.count += n; item.count -= n;
    if (item.count <= 0) removeItem(srcRoot, uid);
    return true;
  }
  if (target.slot && !target.mod) {
    if (!canEquip(dstRoot, target.slot, item)) return false;
    if (dstRoot.equip[target.slot] && dstRoot.equip[target.slot].uid !== uid) return false;
    removeItem(srcRoot, uid);
    delete item.x; delete item.y; item.rot = false;
    dstRoot.equip[target.slot] = item;
    return true;
  }
  if (target.mod) {
    const w = findItem(dstRoot, target.mod);
    if (!w || !w.item.mods) return false;
    const wdef = ITEMS[w.item.id];
    const mdef = ITEMS[item.id];
    if (mdef.cat !== 'mod' || mdef.mod.slot !== target.slot) return false;
    if (w.item.mods[target.slot]) return false;
    // 簡易互換チェックは呼び出し側（modFits）
    removeItem(srcRoot, uid);
    delete item.x; delete item.y; item.rot = false;
    w.item.mods[target.slot] = item;
    void wdef;
    return true;
  }
  const grid = findGrid(dstRoot, target.gid);
  if (!grid) return false;
  // 自分自身の中には入れられない
  const owner = listGrids(dstRoot).find((g) => g.gid === target.gid)?.owner;
  if (owner && (owner.uid === uid || isDescendant(item, owner.uid))) return false;
  if (owner && item.grids && !canNestContainer(item)) return false;
  if (owner && ITEMS[owner.id].cat === 'secure' && item.grids) return false;
  // 分割（スタックの一部を移動）
  if (target.split && target.split > 0 && target.split < item.count) {
    const part = { ...item, uid: item.uid + 's' + Math.floor(Math.random() * 1e6).toString(36), count: target.split };
    if (!canPlace(grid, part, target.x, target.y, !!target.rot)) return false;
    item.count -= target.split;
    part.x = target.x; part.y = target.y; part.rot = !!target.rot;
    grid.items.push(part);
    return true;
  }
  if (!canPlace(grid, item, target.x, target.y, !!target.rot, uid)) return false;
  removeItem(srcRoot, uid);
  item.x = target.x; item.y = target.y; item.rot = !!target.rot;
  grid.items.push(item);
  return true;
}

export function rootWeight(root) {
  let w = 0;
  if (root.equip) for (const s of EQUIP_SLOTS) if (root.equip[s]) w += itemWeight(root.equip[s]);
  if (root.pockets) for (const it of root.pockets.items) w += itemWeight(it);
  return w;
}

// 弾薬の検索・消費（リグ → ポケット → バックパック の順）
export function ammoGrids(root) {
  const out = [];
  if (root.equip?.rig?.grids) out.push(...root.equip.rig.grids);
  if (root.pockets) out.push(root.pockets);
  if (root.equip?.backpack?.grids) out.push(...root.equip.backpack.grids);
  if (root.equip?.secure?.grids) out.push(...root.equip.secure.grids);
  return out;
}
export function countAmmo(root, caliber) {
  const res = {};
  for (const g of ammoGrids(root)) for (const it of g.items) {
    const d = ITEMS[it.id];
    if (d.cat === 'ammo' && d.ammo.caliber === caliber) res[it.id] = (res[it.id] || 0) + it.count;
  }
  return res;
}
export function takeAmmo(root, ammoId, n) {
  let got = 0;
  for (const g of ammoGrids(root)) {
    for (let i = g.items.length - 1; i >= 0 && got < n; i--) {
      const it = g.items[i];
      if (it.id !== ammoId) continue;
      const k = Math.min(n - got, it.count);
      it.count -= k; got += k;
      if (it.count <= 0) g.items.splice(i, 1);
    }
  }
  return got;
}

// アクターの所持アイテムを平坦化（クエスト判定・価値計算など）
export function allItems(root, includeEquip = true) {
  const out = [];
  const walk = (it) => {
    out.push(it);
    if (it.mods) for (const m of Object.values(it.mods)) if (m) out.push(m);
    if (it.grids) for (const g of it.grids) for (const c of g.items) walk(c);
  };
  if (root.equip && includeEquip) for (const s of EQUIP_SLOTS) if (root.equip[s]) walk(root.equip[s]);
  for (const g of [root.pockets, root.grid]) if (g) for (const it of g.items) walk(it);
  return out;
}

export function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

// 空いている装備スロットがあればそこに装着し、なければ自動格納する。戻り値：'equip' | 'insert' | false
export function equipSlotFor(root, item) {
  if (!root?.equip) return null;
  const def = ITEMS[item.id];
  const order = def.cat === 'weapon' ? (def.weapon.class === 'pistol' ? ['holster'] : ['primary', 'secondary']) : [{ armor: 'armor', helmet: 'helmet', rig: 'rig', backpack: 'backpack', secure: 'secure' }[def.cat]];
  for (const s of order) if (s && !root.equip[s] && canEquip(root, s, item)) return s;
  return null;
}
export function autoEquipOrInsert(root, item, opts = {}) {
  const slot = equipSlotFor(root, item);
  if (slot) {
    delete item.x; delete item.y; item.rot = false;
    root.equip[slot] = item;
    return 'equip';
  }
  return autoInsert(root, item, opts) ? 'insert' : false;
}
