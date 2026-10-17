// インベントリ操作の適用（サーバー・クライアント共通）
import { ITEMS, modFits, slotAccepts } from './items.js';
import { moveItem, findItem, removeItem, autoInsert, autoEquipOrInsert } from './inventory.js';

// op: { uid, target: {auto} | {mod, slot} | {slot} | {merge} | {gid,x,y,rot,split} }
export function applyOp(src, dst, op) {
  const f = findItem(src, op.uid);
  if (!f) return false;
  const t = op.target;
  if (t.auto) {
    // 入らなかったときに元の場所（装備スロット・パーツ・グリッドの同じ位置）へ正確に戻せるよう覚えておく
    const from = { slot: f.slot, modOf: f.modOf, modSlot: f.modSlot, grid: f.grid, x: f.item.x, y: f.item.y, rot: f.item.rot };
    const it = removeItem(src, op.uid);
    if (!it) return false;
    if (autoEquipOrInsert(dst, it, { allowSecure: false })) return true;
    // スタックの一部だけ移せた場合は、残りを元の場所に戻す
    if (from.slot) src.equip[from.slot] = it;
    else if (from.modOf) from.modOf.mods[from.modSlot] = it;
    else if (from.grid) { it.x = from.x; it.y = from.y; it.rot = from.rot; from.grid.items.push(it); }
    else autoInsert(src, it, { allowSecure: true });
    return false;
  }
  if (t.mod) {
    const w = findItem(dst, t.mod);
    if (!w || !modFits(ITEMS[w.item.id], ITEMS[f.item.id])) return false;
    if (w.item.uid === op.uid) return false;
    return moveItem(src, op.uid, dst, t);
  }
  if (t.slot) {
    if (!slotAccepts(t.slot, ITEMS[f.item.id])) return false;
    return moveItem(src, op.uid, dst, t);
  }
  return moveItem(src, op.uid, dst, t);
}
