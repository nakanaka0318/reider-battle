// ドラッグ＆ドロップ対応のグリッドインベントリ UI
import { h, showTooltip, moveTooltip, hideTooltip, contextMenu } from './dom.js';
import { itemTooltip } from './itemtip.js';
import { ITEMS, RARITY_COLORS, SLOT_NAMES, slotAccepts, modFits } from '../../shared/items.js';
import { listGrids, findItem, canPlace, dims } from '../../shared/inventory.js';
import { getItemIcon } from '../icons.js';

export function cellSize() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--cell');
  return parseInt(v) || 52;
}
const SLOT_SIZE = { primary: [5, 2], secondary: [5, 2], holster: [3, 2], helmet: [2, 2], armor: [3, 3], rig: [3, 3], backpack: [3, 3], secure: [2, 2] };

let drag = null; // 現在のドラッグ状態（全 InvView 共通）
let touchMode = false; // 一度でもタッチ操作されたらホバーのツールチップを出さない

export class InvView {
  constructor(opts) {
    this.o = opts;
    this.mounts = [];
    this._onKey = (e) => {
      if (!drag || drag.view !== this) return;
      if (e.code === 'KeyR') { drag.rot = !drag.rot; updateGhost(); updateHover(drag.lastX, drag.lastY); e.preventDefault(); }
    };
    addEventListener('keydown', this._onKey);
  }
  destroy() { removeEventListener('keydown', this._onKey); this.mounts = []; }
  roots() { return this.o.roots(); }

  refresh() { for (const m of this.mounts) if (m.el.isConnected) m.render(); this.mounts = this.mounts.filter((m) => m.el.isConnected || m.keep); }

  mount(el, render) {
    const m = { el, render: () => { el.innerHTML = ''; render(el); } };
    m.render();
    this.mounts.push(m);
    return el;
  }

  // ---------------------------------------------------------------- 装備パネル
  equipment(ref, opts = {}) {
    return this.mount(h('div', { class: 'equip-panel' }), (el) => {
      const root = this.roots()[ref];
      if (!root) return;
      const C = cellSize();
      const slotEl = (s) => {
        const [w, hh] = SLOT_SIZE[s];
        const it = root.equip[s];
        const box = h('div', { class: 'slot', style: { width: w * C + 'px', height: hh * C + 'px' }, dataset: { ref, slot: s } }, h('span', { class: 'slot-label' }, SLOT_NAMES[s]));
        if (it) box.append(this.itemEl(ref, it, { fit: [w, hh] }));
        return box;
      };
      el.append(
        h('div', { class: 'row', style: { gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' } },
          h('div', { class: 'col', style: { gap: '8px' } }, slotEl('helmet'), slotEl('secure')),
          h('div', { class: 'col', style: { gap: '8px' } }, slotEl('armor'), slotEl('holster')),
          h('div', { class: 'col', style: { gap: '8px' } }, slotEl('rig'), slotEl('backpack')),
        ),
        h('div', { class: 'col', style: { gap: '8px', marginTop: '8px' } }, slotEl('primary'), slotEl('secondary')),
      );
      if (opts.noGrids) return;
      el.append(this.equipGrids(ref, root));
    });
  }

  equipGrids(ref, root) {
    const wrap = h('div', {});
    const grids = listGrids(root);
    const section = (title, gs) => {
      if (!gs.length) return;
      const cap = gs.reduce((s, g) => s + g.grid.w * g.grid.h, 0);
      const used = gs.reduce((s, g) => s + g.grid.items.reduce((a, it) => a + ITEMS[it.id].w * ITEMS[it.id].h, 0), 0);
      wrap.append(h('div', { class: 'grid-title' }, h('span', {}, title), h('span', { class: 'num' }, `${used}/${cap}`)));
      wrap.append(h('div', { class: 'grids-row' }, gs.map((g) => this.gridEl(ref, g.gid, g.grid))));
    };
    section('ポケット', grids.filter((g) => g.gid === 'pockets'));
    if (root.equip.rig) section('リグ — ' + ITEMS[root.equip.rig.id].name, grids.filter((g) => g.slot === 'rig'));
    if (root.equip.backpack) section('バックパック — ' + ITEMS[root.equip.backpack.id].name, grids.filter((g) => g.slot === 'backpack'));
    if (root.equip.secure) section('セキュア — ' + ITEMS[root.equip.secure.id].name, grids.filter((g) => g.slot === 'secure'));
    return wrap;
  }

  // ---------------------------------------------------------------- 単一グリッド（倉庫・コンテナ）
  gridRoot(ref, opts = {}) {
    return this.mount(h('div', { class: 'grid-root' }), (el) => {
      const root = this.roots()[ref];
      if (!root) return;
      const grids = listGrids(root);
      const main = grids.find((g) => g.gid === 'main');
      if (main) el.append(this.gridEl(ref, 'main', main.grid));
    });
  }

  gridEl(ref, gid, grid) {
    const C = cellSize();
    const g = h('div', { class: 'grid', style: { width: grid.w * C + 1 + 'px', height: grid.h * C + 1 + 'px' }, dataset: { ref, gid } });
    for (const it of grid.items) {
      const el = this.itemEl(ref, it);
      const [w, hh] = dims(it);
      el.style.left = it.x * C + 'px'; el.style.top = it.y * C + 'px';
      el.style.width = w * C + 1 + 'px'; el.style.height = hh * C + 1 + 'px';
      g.append(el);
    }
    return g;
  }

  itemEl(ref, it, opts = {}) {
    const def = ITEMS[it.id];
    const C = cellSize();
    const el = h('div', { class: 'item', dataset: { ref, uid: it.uid } });
    if (opts.fit) {
      const [fw, fh] = opts.fit;
      el.style.width = fw * C - 6 + 'px'; el.style.height = fh * C - 6 + 'px';
      el.style.backgroundImage = `url(${getItemIcon(def, false)})`;
      el.style.backgroundSize = 'contain';
      el.style.backgroundPosition = 'center';
      el.style.margin = '3px';
    } else {
      el.style.backgroundImage = `url(${getItemIcon(def, !!it.rot)})`;
    }
    el.style.backgroundColor = rarityBg(def.rarity);
    el.append(h('i', { class: 'rar', style: { background: RARITY_COLORS[def.rarity] } }));
    el.append(h('span', { class: 'lbl' }, def.short));
    if (def.stack > 1) el.append(h('span', { class: 'cnt' }, it.count));
    else if (def.weapon && it.mag) el.append(h('span', { class: 'cnt' }, it.mag.count));
    else if (def.armor && it.dur != null) el.append(h('span', { class: 'dur' }, `${Math.round(it.dur)}/${def.armor.dur}`));
    else if (def.med && def.med.uses > 1) el.append(h('span', { class: 'cnt' }, `${it.uses ?? def.med.uses}/${def.med.uses}`));
    else if (it.grids) {
      const n = it.grids.reduce((s, gg) => s + gg.items.length, 0);
      if (n) el.append(h('span', { class: 'cnt' }, n));
    }
    if (it.fir && !opts.fit) el.append(h('span', { class: 'fir' }, '✔'));
    el.addEventListener('pointerdown', (e) => this.onItemDown(e, ref, it, el));
    el.addEventListener('mouseenter', (e) => { if (!drag && !touchMode) showTooltip(itemTooltip(it, this.o.tooltipExtra?.(ref, it) || {}), e.clientX, e.clientY); });
    el.addEventListener('mousemove', (e) => moveTooltip(e.clientX, e.clientY));
    el.addEventListener('mouseleave', hideTooltip);
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault(); hideTooltip();
      const items = this.o.contextItems?.(ref, it) || [];
      if (items.length) contextMenu(e.clientX, e.clientY, items);
    });
    el.addEventListener('dblclick', (e) => { e.preventDefault(); this.o.onDouble?.(ref, it); });
    return el;
  }

  onItemDown(e, ref, it, el) {
    if (e.button !== 0) return;
    e.preventDefault();
    hideTooltip();
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (isTouch) touchMode = true;
    if (e.ctrlKey || e.metaKey) {
      const dst = this.o.quickTarget?.(ref, it);
      if (dst) this.o.apply(ref, dst, { uid: it.uid, target: { auto: true } });
      return;
    }
    const r = el.getBoundingClientRect();
    const C = cellSize();
    const start = { x: e.clientX, y: e.clientY };
    const fitted = el.parentElement?.classList.contains('slot');
    const pre = {
      view: this, ref, it, el, rot: !!it.rot, started: false, shift: e.shiftKey,
      grabX: fitted ? 0 : Math.floor((e.clientX - r.left) / C), grabY: fitted ? 0 : Math.floor((e.clientY - r.top) / C),
      lastX: e.clientX, lastY: e.clientY,
    };
    const pid = e.pointerId;
    const move = (ev) => {
      if (ev.pointerId !== pid) return;
      if (!pre.started) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < (isTouch ? 10 : 5)) return;
        pre.started = true;
        drag = pre;
        el.classList.add('dragging');
        pre.ghost = h('div', { class: 'drag-ghost' });
        document.body.append(pre.ghost);
        if (isTouch) {
          // タッチ操作ではもう一本の指で押せる回転ボタンを出す
          pre.rotBtn = h('div', { class: 'drag-rotate' }, '↻ 回転');
          pre.rotBtn.addEventListener('pointerdown', (re) => { re.preventDefault(); re.stopPropagation(); if (drag) { drag.rot = !drag.rot; updateGhost(); updateHover(drag.lastX, drag.lastY); } });
          document.body.append(pre.rotBtn);
        }
        updateGhost();
      }
      pre.lastX = ev.clientX; pre.lastY = ev.clientY;
      updateHover(ev.clientX, ev.clientY);
    };
    const up = (ev) => {
      if (ev.pointerId !== pid) return;
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      if (!pre.started) {
        // タッチでのタップ：メニュー（詳細・使用・移動など）を開く
        if (isTouch && ev.type === 'pointerup') {
          const items = this.o.contextItems?.(ref, it) || [];
          const dst = this.o.quickTarget?.(ref, it);
          const all = items.some((x) => x.text.startsWith('詳細')) ? [] : [{ text: 'ℹ 詳細', fn: () => { showTooltip(itemTooltip(it, this.o.tooltipExtra?.(ref, it) || {}), ev.clientX, ev.clientY); setTimeout(() => addEventListener('pointerdown', hideTooltip, { once: true }), 0); } }];
          if (dst) all.push({ text: ref === 'self' ? '⇢ 移動（相手側へ）' : ref === 'stash' ? '⇢ 装備へ移動' : ref === 'loadout' ? '⇢ 倉庫へ移動' : '⇢ 取る', fn: () => this.o.apply(ref, dst, { uid: it.uid, target: { auto: true } }) });
          contextMenu(ev.clientX, ev.clientY, [...all, ...items]);
        }
        return;
      }
      const res = pre.hover;
      clearHover();
      pre.rotBtn?.remove();
      pre.ghost.remove();
      el.classList.remove('dragging');
      drag = null;
      if (res && res.ok) this.o.apply(pre.ref, res.ref, { uid: it.uid, target: res.target });
      else if (!res && this.o.onDropOutside) this.o.onDropOutside(pre.ref, it, ev);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  }
}

function rarityBg(r) {
  return ['rgba(38,43,46,.9)', 'rgba(34,48,36,.9)', 'rgba(30,40,56,.9)', 'rgba(46,34,58,.9)', 'rgba(60,48,24,.9)', 'rgba(62,28,28,.9)'][r] || 'rgba(38,43,46,.9)';
}

function updateGhost() {
  if (!drag?.ghost) return;
  const def = ITEMS[drag.it.id];
  const C = cellSize();
  const [w, hh] = drag.rot ? [def.h, def.w] : [def.w, def.h];
  drag.ghost.style.width = w * C + 'px';
  drag.ghost.style.height = hh * C + 'px';
  drag.ghost.style.backgroundImage = `url(${getItemIcon(def, drag.rot)})`;
  positionGhost(drag.lastX, drag.lastY);
}
function positionGhost(x, y) {
  const C = cellSize();
  const gx = drag.rot ? drag.grabY : drag.grabX, gy = drag.rot ? drag.grabX : drag.grabY;
  drag.ghost.style.left = x - gx * C - C / 2 + 'px';
  drag.ghost.style.top = y - gy * C - C / 2 + 'px';
}

let hlEl = null, slotHl = null;
function clearHover() {
  hlEl?.remove(); hlEl = null;
  if (slotHl) { slotHl.classList.remove('drop-ok', 'drop-bad'); slotHl = null; }
  if (drag) drag.hover = null;
}

function updateHover(x, y) {
  if (!drag) return;
  positionGhost(x, y);
  clearHover();
  const el = document.elementFromPoint(x, y);
  if (!el) return;
  const view = drag.view;
  const roots = view.roots();
  const def = ITEMS[drag.it.id];
  // MOD スロット（武器詳細）
  const ms = el.closest('[data-modslot]');
  if (ms) {
    const ref = ms.dataset.ref, root = roots[ref];
    const w = root && findItem(root, ms.dataset.weapon);
    const ok = !!w && modFits(ITEMS[w.item.id], def) && !w.item.mods[ms.dataset.modslot] && def.mod?.slot === ms.dataset.modslot;
    ms.classList.add(ok ? 'drop-ok' : 'drop-bad'); slotHl = ms;
    drag.hover = { ok, ref, target: { mod: ms.dataset.weapon, slot: ms.dataset.modslot } };
    return;
  }
  // 装備スロット
  const slot = el.closest('.slot[data-slot]');
  if (slot) {
    const ref = slot.dataset.ref, root = roots[ref];
    const s = slot.dataset.slot;
    const occupied = root?.equip?.[s];
    let ok = !!root && slotAccepts(s, def) && (!occupied || occupied.uid === drag.it.uid);
    if (ok && s === 'armor' && root.equip.rig && ITEMS[root.equip.rig.id].armor) ok = false;
    if (ok && s === 'rig' && def.armor && root.equip.armor) ok = false;
    // スロット内の武器に MOD を付ける
    if (!ok && occupied && def.cat === 'mod' && modFits(ITEMS[occupied.id], def) && !occupied.mods?.[def.mod.slot]) {
      ok = true;
      slot.classList.add('drop-ok'); slotHl = slot;
      drag.hover = { ok, ref, target: { mod: occupied.uid, slot: def.mod.slot } };
      return;
    }
    slot.classList.add(ok ? 'drop-ok' : 'drop-bad'); slotHl = slot;
    drag.hover = { ok, ref, target: { slot: s } };
    return;
  }
  // 同種スタックへ統合
  const itEl = el.closest('.item[data-uid]');
  if (itEl && itEl.dataset.uid !== drag.it.uid) {
    const ref = itEl.dataset.ref;
    const f = roots[ref] && findItem(roots[ref], itEl.dataset.uid);
    if (f && f.item.id === drag.it.id && def.stack > 1 && f.item.count < def.stack) {
      drag.hover = { ok: true, ref, target: { merge: f.item.uid } };
      itEl.style.outline = '2px solid #5fae5a';
      setTimeout(() => { itEl.style.outline = ''; }, 120);
      return;
    }
    // 武器に MOD をドロップ
    if (f && ITEMS[f.item.id].weapon && def.cat === 'mod' && modFits(ITEMS[f.item.id], def) && !f.item.mods?.[def.mod.slot]) {
      drag.hover = { ok: true, ref, target: { mod: f.item.uid, slot: def.mod.slot } };
      itEl.style.outline = '2px solid #5fae5a';
      setTimeout(() => { itEl.style.outline = ''; }, 120);
      return;
    }
  }
  // グリッド
  const gEl = el.closest('.grid[data-gid]');
  if (gEl) {
    const ref = gEl.dataset.ref, gid = gEl.dataset.gid;
    const root = roots[ref];
    const g = root && listGrids(root).find((q) => q.gid === gid);
    if (!g) return;
    const C = cellSize();
    const gr = gEl.getBoundingClientRect();
    const gx = drag.rot ? drag.grabY : drag.grabX, gy = drag.rot ? drag.grabX : drag.grabY;
    const cx = Math.round((x - gx * C - C / 2 - gr.left) / C), cy = Math.round((y - gy * C - C / 2 - gr.top) / C);
    const fake = { ...drag.it, uid: drag.it.uid };
    let ok = canPlace(g.grid, fake, cx, cy, drag.rot, drag.it.uid);
    if (g.owner && (g.owner.uid === drag.it.uid)) ok = false;
    if (g.owner && drag.it.grids && drag.it.grids.some((q) => q.items.length)) ok = false;
    if (g.owner && ITEMS[g.owner.id].cat === 'secure' && drag.it.grids) ok = false;
    const [w, hh] = drag.rot ? [def.h, def.w] : [def.w, def.h];
    hlEl = h('div', { class: 'hl ' + (ok ? 'ok' : 'bad'), style: { left: cx * C + 'px', top: cy * C + 'px', width: w * C + 'px', height: hh * C + 'px' } });
    gEl.append(hlEl);
    const target = { gid, x: cx, y: cy, rot: drag.rot };
    if (drag.shift && def.stack > 1 && drag.it.count > 1) target.split = Math.floor(drag.it.count / 2);
    drag.hover = { ok, ref, target };
  }
}
