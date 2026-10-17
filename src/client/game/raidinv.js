// レイド中のインベントリ画面（Tab）と戦利品パネル
import { h, toast, hideTooltip } from '../ui/dom.js';
import { InvView } from '../ui/invview.js';
import { ITEMS, itemValue } from '../../shared/items.js';
import { PARTS, PART_HP, PART_NAMES } from '../../shared/combat.js';
import { findItem } from '../../shared/inventory.js';

export class RaidInventory {
  constructor(game) {
    this.g = game;
    this.el = h('div', { class: 'raid-inv hidden' });
    game.root.append(this.el);
    this.view = new InvView({
      roots: () => {
        const r = { self: game.inv };
        if (game.loot) r[game.loot.root] = game.loot.inv;
        return r;
      },
      apply: (s, d, op) => game.net.send({ t: 'inv', src: s, dst: d, uid: op.uid, target: op.target }),
      quickTarget: (ref) => (ref === 'self' ? (game.loot ? game.loot.root : null) : 'self'),
      contextItems: (ref, it) => this.ctx(ref, it),
      onDouble: (ref, it) => {
        const def = ITEMS[it.id];
        if (ref === 'self' && def.med) { game.useItem(it.uid); }
        else if (ref !== 'self') game.net.send({ t: 'inv', src: ref, dst: 'self', uid: it.uid, target: { auto: true } });
      },
      onDropOutside: (ref, it, ev) => {
        if (ref === 'self' && ev.target?.closest?.('.drop-zone')) game.net.send({ t: 'drop', uid: it.uid });
      },
    });
    this.open = false;
  }

  ctx(ref, it) {
    const g = this.g;
    const def = ITEMS[it.id];
    const out = [];
    if (ref === 'self') {
      if (def.med) out.push({ text: '使用する', fn: () => g.useItem(it.uid) });
      if (def.weapon && it.mag?.count) out.push({ text: '弾を抜く', fn: () => g.net.send({ t: 'unload', uid: it.uid }) });
      if (def.grenade) out.push({ text: '投擲物として選択', fn: () => { g.preferredNade = it.uid; toast(`${def.name} を選択（Gで投擲）`); } });
      out.push({ text: '捨てる', fn: () => g.net.send({ t: 'drop', uid: it.uid }) });
    } else {
      out.push({ text: '取る', fn: () => g.net.send({ t: 'inv', src: ref, dst: 'self', uid: it.uid, target: { auto: true } }) });
    }
    return out;
  }

  show(on) {
    this.open = on;
    this.el.classList.toggle('hidden', !on);
    if (!on) { hideTooltip(); return; }
    this.render();
  }

  render() {
    if (!this.open) return;
    const g = this.g;
    this.el.innerHTML = '';
    this.view.mounts = [];
    const S = g.selfState || {};
    // 体力パネル
    const doll = h('div', { class: 'health-doll' });
    const DOLL = { head: [44, 0, 32, 30], thorax: [32, 34, 56, 50], stomach: [36, 88, 48, 30], armL: [6, 34, 22, 72], armR: [92, 34, 22, 72], legL: [32, 122, 26, 86], legR: [62, 122, 26, 86] };
    for (const p of PARTS) {
      const [x, y, w, hh] = DOLL[p];
      const v = S.hp?.[p] ?? PART_HP[p];
      const f = v / PART_HP[p];
      const col = S.dest?.[p] ? '#111' : f > 0.7 ? '#4a7a4a' : f > 0.35 ? '#9a7a2a' : '#9a2a1a';
      doll.append(h('div', { class: 'part', title: PART_NAMES[p], style: { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px', background: col, outline: S.bleed?.[p] ? '2px solid #f33' : S.frac?.[p] ? '2px solid #fc3' : '' } }, Math.round(v)));
    }
    const status = [];
    for (const p of PARTS) {
      if (S.bleed?.[p] === 2) status.push(`${PART_NAMES[p]}: 重出血`);
      else if (S.bleed?.[p]) status.push(`${PART_NAMES[p]}: 出血`);
      if (S.frac?.[p]) status.push(`${PART_NAMES[p]}: 骨折`);
      if (S.dest?.[p]) status.push(`${PART_NAMES[p]}: 破壊`);
    }
    const health = h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, '体力'),
      h('div', { class: 'health-panel' }, doll, h('div', { class: 'health-stats' },
        h('div', {}, `エネルギー ${Math.round(S.en ?? 100)}`), h('div', {}, `水分 ${Math.round(S.hy ?? 100)}`), h('div', {}, `重量 ${(S.wt ?? 0).toFixed(1)} / ${S.cap ?? 22} kg`),
        status.map((s) => h('div', { style: { color: '#f88' } }, s)),
        h('div', { class: 'mini', style: { marginTop: '6px' } }, ...(g.touch ? ['医薬品をタップ →「使用する」'] : ['医薬品をダブルクリックで使用', h('br'), 'H キー：状態に合う医薬品を自動使用'])))));
    const equip = h('div', { class: 'panel', style: { overflow: 'auto' } }, h('div', { class: 'panel-h' }, '装備', h('span', { class: 'sub' }, `所持品の価値 ${Math.round(itemsVal(g.inv) / 1000)}k C`)), h('div', { class: 'panel-b' }, this.view.equipment('self')));
    const left = h('div', { class: 'side', style: { gap: '10px', maxHeight: '100%' } }, health,
      h('div', { class: 'panel drop-zone', style: { padding: '14px', textAlign: 'center', color: '#999', borderStyle: 'dashed' } }, 'ここにドロップして地面に捨てる'),
      h('div', { class: 'mini', style: { lineHeight: 1.7 } }, ...(g.touch ? ['タップでメニュー / ドラッグで移動', h('br'), 'ドラッグ中に上の「回転」をもう一本の指で押すと回転'] : ['ドラッグで移動 / R で回転 / Ctrl+クリックで素早く移動', h('br'), '右クリックでメニュー / Tab で閉じる'])));
    left.prepend(h('button', { class: 'btn primary', style: { width: '100%' }, onclick: () => g.toggleInv(false) }, '✕ 閉じる（Tab）'));
    this.el.append(left, h('div', { class: 'side', style: { maxHeight: '100%', overflow: 'auto' } }, equip));
    if (g.loot) {
      const L = g.loot;
      const content = L.kind === 'body'
        ? h('div', { class: 'panel-b' }, this.view.equipment(L.root))
        : h('div', { class: 'panel-b' }, this.view.gridRoot(L.root));
      const takeAll = h('button', { class: 'btn small', onclick: () => {
        const items = L.kind === 'body' ? [] : [...(L.inv.grid?.items || [])];
        if (L.kind === 'body') {
          for (const s of ['primary', 'secondary', 'holster', 'helmet', 'armor', 'rig', 'backpack']) if (L.inv.equip?.[s]) items.push(L.inv.equip[s]);
          items.push(...(L.inv.pockets?.items || []));
        }
        items.sort((a, b) => itemValue(b) - itemValue(a));
        for (const it of items) g.net.send({ t: 'inv', src: L.root, dst: 'self', uid: it.uid, target: { auto: true } });
      } }, 'すべて取る');
      this.el.append(h('div', { class: 'side', style: { maxHeight: '100%', overflow: 'auto' } }, h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, L.name, h('span', { class: 'sub' }, L.kind === 'body' ? '死体' : 'コンテナ'), takeAll), content)));
    }
  }

  refresh() { if (this.open) this.render(); }
  dispose() { this.view.destroy(); this.el.remove(); }
}

function itemsVal(root) {
  let v = 0;
  if (!root) return 0;
  for (const s of Object.keys(root.equip || {})) if (root.equip[s]) v += itemValue(root.equip[s]);
  for (const it of root.pockets?.items || []) v += itemValue(it);
  return v;
}
void findItem;
