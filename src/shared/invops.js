// インベントリ操作の適用（サーバー・クライアント共通）
import { ITEMS, modFits, slotAccepts } from './items.js';
import { moveItem, findItem, removeItem, autoInsert } from './inventory.js';

// op: { uid, target: {auto} | {mod, slot} | {slot} | {merge} | {gid,x,y,rot,split} }
export function applyOp(src, dst, op) {
  const f = findItem(src, op.uid);
  if (!f) return false;
  const t = op.target;
  if (t.auto) {
    const it = removeItem(src, op.uid);
    if (!it) return false;
    if (autoInsert(dst, it, { allowSecure: false })) return true;
    autoInsert(src, it, { allowSecure: true });
    // 元に戻せなかった場合（通常起こらない）
    if (!findItem(src, it.uid)) autoInsert(src, it, { allowSecure: true });
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
