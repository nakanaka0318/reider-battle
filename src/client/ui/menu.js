// メインメニュー：倉庫・トレーダー・ハイドアウト・クエスト・出撃・記録
import { h, toast, modal, confirmBox, fmt, hideTooltip, showTooltip, moveTooltip } from './dom.js';
import { InvView, cellSize } from './invview.js';
import { itemTooltip, SLOT_JP, CLASS_NAMES } from './itemtip.js';
import { ITEMS, ITEM_LIST, CAT_NAMES, RARITY_COLORS, weaponStats, modFits, itemValue, createItem, EQUIP_SLOTS, SLOT_NAMES, slotAccepts } from '../../shared/items.js';
import { findItem, removeItem, autoInsert, rootWeight, allItems, listGrids, canEquip, carryCapacity } from '../../shared/inventory.js';
import { applyOp } from '../../shared/invops.js';
import { TRADERS, STATIONS, QUESTS, RECIPES, XP_LEVELS } from '../../shared/data/meta.js';
import * as PF from '../profile.js';
import { getItemIcon } from '../icons.js';
import { drawMapPreview } from './mapview.js';
import { drawPortrait } from './portrait.js';
import { buildHintsPage } from './hints.js';
import { favoritesModal } from './favorites.js';
import { sellModal } from './sellmodal.js';

const OFFLINE_ONLY = !!import.meta.env?.VITE_OFFLINE_ONLY;

export class Menu {
  constructor(root, { onDeploy, onSettings, onPlayers }) {
    this.onPlayers = onPlayers;
    this.root = root;
    this.onDeploy = onDeploy;
    this.onSettings = onSettings;
    this.tab = 'stash';
    this.trader = TRADERS[0].id;
    this.deployOpts = { difficulty: 'normal', mode: 'offline', timeOfDay: 'day', duration: 30, density: 'normal', raiders: 9 };
    try { Object.assign(this.deployOpts, JSON.parse(localStorage.getItem('rb-deploy') || '{}')); } catch { /* noop */ }
    if (OFFLINE_ONLY) this.deployOpts.mode = 'offline';
    this.inv = new InvView({
      roots: () => ({ stash: PF.profile().stash, loadout: PF.profile().loadout }),
      apply: (s, d, op) => this.applyLocal(s, d, op),
      quickTarget: (ref) => (ref === 'stash' ? 'loadout' : 'stash'),
      contextItems: (ref, it) => this.ctxItems(ref, it),
      onDouble: (ref, it) => this.inspect(ref, it),
      tooltipExtra: (ref, it) => {
        const b = PF.bestTraderFor(it);
        return b.price ? { price: b.price, priceLabel: `売却（${b.trader.name}）` } : {};
      },
      onDropOutside: (ref, it, ev) => {
        const z = ev.target?.closest?.('.sell-zone');
        if (z) this.sell(ref, it, TRADERS.find((t) => t.id === z.dataset.trader));
      },
    });
    this.unsub = PF.onProfileChange(() => this.updateTop());
    this.build();
    this.timer = setInterval(() => { if (this.tab === 'hideout') this.refreshHideoutProgress(); }, 1000);
  }
  destroy() { clearInterval(this.timer); this.unsub(); this.inv.destroy(); this.root.innerHTML = ''; hideTooltip(); }

  applyLocal(s, d, op) {
    const P = PF.profile();
    const roots = { stash: P.stash, loadout: P.loadout };
    const ok = applyOp(roots[s], roots[d], op);
    if (!ok) toast('そこには置けない', 'warn');
    PF.commit();
    this.inv.refresh();
    this.refreshSide();
  }

  build() {
    const P = PF.profile();
    this.root.innerHTML = '';
    const tabs = [['stash', '倉庫・装備'], ['traders', 'トレーダー'], ['hideout', 'ハイドアウト'], ['quests', 'タスク'], ['deploy', '出撃'], ['hints', 'ヒント'], ['records', '記録']];
    this.topEls = {
      money: h('b', { class: 'money' }), level: h('b', {}), xp: h('i', {}), value: h('b', {}),
    };
    const top = h('div', { class: 'topbar' },
      h('div', { class: 'brand' }, 'RAIDER', h('span', {}, ' BATTLE')),
      h('div', { class: 'tabs' }, tabs.map(([id, name]) => h('div', { class: 'tab' + (this.tab === id ? ' active' : ''), onclick: () => { this.tab = id; this.build(); } }, name))),
      h('div', { class: 'spacer' }),
      h('div', { class: 'stat-chip total' }, '総資産', this.topEls.value),
      h('div', { class: 'stat-chip' }, P.name + ' ・ レベル', this.topEls.level, h('div', { class: 'xpbar' }, this.topEls.xp)),
      h('div', { class: 'stat-chip' }, 'クレジット', this.topEls.money),
      h('button', { class: 'btn small', title: 'プレイヤー', onclick: () => this.onPlayers() }, '👤', h('span', { class: 'lbl' }, ' プレイヤー')),
      h('button', { class: 'btn small', title: '設定', onclick: () => this.onSettings() }, '⚙', h('span', { class: 'lbl' }, ' 設定')),
    );
    this.content = h('div', { class: 'content' });
    this.root.append(h('div', { class: 'menu' }, top, this.content));
    this.updateTop();
    this.inv.mounts = [];
    const page = { stash: () => this.pageStash(), traders: () => this.pageTraders(), hideout: () => this.pageHideout(), quests: () => this.pageQuests(), deploy: () => this.pageDeploy(), hints: () => buildHintsPage(), records: () => this.pageRecords() }[this.tab];
    this.content.append(page());
  }

  updateTop() {
    const P = PF.profile();
    if (!this.topEls) return;
    this.topEls.money.textContent = fmt(P.money) + ' C';
    const lv = PF.level();
    this.topEls.level.textContent = lv;
    const a = XP_LEVELS[lv - 1] || 0, b = XP_LEVELS[lv] || a + 1;
    this.topEls.xp.style.width = Math.min(100, ((P.xp - a) / (b - a)) * 100) + '%';
    this.topEls.value.textContent = fmt(PF.stashValue() + P.money) + ' C';
  }

  // ---------------------------------------------------------------- 倉庫
  pageStash() {
    const P = PF.profile();
    this.side = h('div', { class: 'panel-b' });
    const page = h('div', { class: 'page', style: { overflow: 'hidden' } },
      h('div', { class: 'inv-layout' },
        h('div', { class: 'inv-col scroll', style: { width: 'auto', minWidth: '420px' } },
          h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, '装備（出撃時に持ち込む）', h('span', { class: 'sub', id: 'lo-weight' }), h('button', { class: 'btn small', onclick: () => this.favoritesModal() }, '★ お気に入り'), h('button', { class: 'btn small primary', onclick: () => this.autoEquipModal() }, 'おまかせ装備')), h('div', { class: 'panel-b' }, this.inv.equipment('loadout'))),
        ),
        h('div', { class: 'inv-col', style: { flex: '0 0 auto' } },
          h('div', { class: 'panel', style: { display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '100%' } },
            h('div', { class: 'panel-h' }, '倉庫', h('span', { class: 'sub', id: 'stash-info' }),
              h('button', { class: 'btn small primary', onclick: () => this.sellModal() }, 'まとめて売却'),
              h('button', { class: 'btn small', onclick: () => this.sortStash() }, '整列'),
              h('button', { class: 'btn small', onclick: () => { const n = PF.depositCredits(); PF.commit(); this.inv.refresh(); toast(n ? `${fmt(n)} C を入金した` : '入金できるクレジットはない'); } }, '入金')),
            h('div', { class: 'inv-scroll', style: { padding: '8px' } }, this.inv.gridRoot('stash')),
          ),
        ),
        h('div', { class: 'inv-col scroll grow', style: { minWidth: '240px' } },
          h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, 'ステータス'), this.side),
          h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, '操作'), h('div', { class: 'panel-b mini', style: { lineHeight: 1.8 } },
            'ドラッグ: 移動 ／ ドラッグ中 R: 回転', h('br'), 'Ctrl+クリック: 装備⇔倉庫 へ素早く移動', h('br'), 'Shift+ドラッグ: スタックを分割', h('br'), 'ダブルクリック: 詳細・武器カスタマイズ', h('br'), '右クリック: 売却・弾抜き・破棄など',
            h('div', { class: 'sell-zone', dataset: { trader: 'luka' }, style: { marginTop: '10px', border: '1px dashed #6a4a8a', padding: '14px', textAlign: 'center', color: '#b090d0' } }, 'ここにドロップでルカに売却'))),
        ),
      ),
    );
    this.refreshSide();
    return page;
  }

  refreshSide() {
    const P = PF.profile();
    if (!this.side) return;
    const lo = P.loadout;
    const w = rootWeight(lo);
    const li = document.getElementById('lo-weight');
    if (li) li.textContent = `${w.toFixed(1)} kg ・ 価値 ${fmt(PF.itemsValue(lo))} C`;
    const si = document.getElementById('stash-info');
    if (si) {
      const used = P.stash.grid.items.reduce((s, it) => s + ITEMS[it.id].w * ITEMS[it.id].h, 0);
      si.textContent = `${used}/${P.stash.grid.w * P.stash.grid.h} ・ ${fmt(PF.itemsValue(P.stash))} C`;
    }
    const prim = lo.equip.primary || lo.equip.secondary || lo.equip.holster;
    const armor = lo.equip.armor || (lo.equip.rig && ITEMS[lo.equip.rig.id].armor ? lo.equip.rig : null);
    this.side.innerHTML = '';
    this.side.append(
      h('div', { class: 'col', style: { gap: '4px', fontSize: '13px' } },
        h('div', { class: 'row' }, 'エネルギー', h('span', { class: 'grow' }), h('b', { class: 'num' }, Math.round(P.health.energy))),
        h('div', { class: 'row' }, '水分', h('span', { class: 'grow' }), h('b', { class: 'num' }, Math.round(P.health.hydration))),
        h('div', { class: 'row' }, '重量 / 耐荷重', h('span', { class: 'grow' }), h('b', { class: 'num', style: { color: w > carryCapacity(lo) + 13 ? '#d24a3a' : w > carryCapacity(lo) ? '#e0c060' : '' } }, `${w.toFixed(1)} / ${carryCapacity(lo)} kg`)),
        h('div', { class: 'sep' }),
        h('div', { class: 'row' }, 'メイン', h('span', { class: 'grow' }), h('span', {}, prim ? ITEMS[prim.id].name : '— なし —')),
        h('div', { class: 'row' }, 'アーマー', h('span', { class: 'grow' }), h('span', {}, armor ? `${ITEMS[armor.id].short} (クラス${ITEMS[armor.id].armor.cls})` : '— なし —')),
        h('div', { class: 'row' }, 'ヘルメット', h('span', { class: 'grow' }), h('span', {}, lo.equip.helmet ? ITEMS[lo.equip.helmet.id].short : '— なし —')),
        h('div', { class: 'sep' }),
        h('div', { class: 'mini' }, '持ち込んだ装備は死亡すると失われます（セキュアコンテナの中身を除く）。'),
      ),
    );
  }

  sortStash() {
    const P = PF.profile();
    const items = P.stash.grid.items.splice(0);
    const order = ['weapon', 'mod', 'ammo', 'grenade', 'armor', 'helmet', 'rig', 'backpack', 'secure', 'med', 'food', 'key', 'valuable', 'intel', 'machine', 'barter', 'money'];
    items.sort((a, b) => {
      const da = ITEMS[a.id], db = ITEMS[b.id];
      const c = order.indexOf(da.cat) - order.indexOf(db.cat);
      if (c) return c;
      const s = db.w * db.h - da.w * da.h;
      if (s) return s;
      return da.id < db.id ? -1 : 1;
    });
    const left = [];
    for (const it of items) { it.rot = false; if (!autoInsert(P.stash, it)) left.push(it); }
    for (const it of left) P.stash.grid.items.push(it);
    PF.commit();
    this.inv.refresh();
  }

  sellModal(opts = {}) {
    sellModal(() => { this.inv.refresh(); this.refreshSide(); this.updateTop(); }, opts);
  }

  favoritesModal() {
    favoritesModal(() => { this.inv.refresh(); this.refreshSide(); this.updateTop(); });
  }

  autoEquipModal() {
    const run = (mode) => {
      const log = PF.autoEquip(mode);
      this.inv.refresh(); this.refreshSide();
      toast(log.length ? `装備した：${log.join('、')}` : '倉庫に使える装備がない', log.length ? 'good' : 'warn');
    };
    const P = PF.profile();
    const budgets = [50000, 100000, 200000, 400000, 800000].filter((b) => b < P.money);
    budgets.push(P.money);
    let budget = budgets[Math.min(1, budgets.length - 1)];
    const chips = h('div', { class: 'opts', style: { margin: '6px 0' } });
    const drawChips = () => {
      chips.innerHTML = '';
      for (const b of budgets) chips.append(h('div', { class: 'opt' + (b === budget ? ' active' : ''), style: { minWidth: '70px', textAlign: 'center' }, onclick: () => { budget = b; drawChips(); } }, h('b', {}, b === P.money ? '全額' : fmt(b / 10000) + '万'), h('small', {}, fmt(b) + ' C')));
    };
    drawChips();
    const m = modal('おまかせ装備', h('div', { style: { maxWidth: '480px', lineHeight: 1.7 } },
      h('b', {}, '倉庫の物で編成'),
      h('div', {}, '倉庫から装備を選んで装着し、武器に弾を込め、予備弾薬・医薬品・水・手榴弾をリグとポケットに詰めます。'),
      h('div', { class: 'mini' }, '「最強に入れ替え」は今の装備より良い物があれば交換します（外した装備は倉庫へ）。死ぬと失うので注意。'),
      h('div', { class: 'row', style: { gap: '6px', margin: '8px 0 14px' } },
        h('button', { class: 'btn', onclick: () => { run('fill'); m.close(); } }, '空きスロットを埋める'),
        h('button', { class: 'btn primary', onclick: () => { run('best'); m.close(); } }, '最強に入れ替え')),
      h('div', { class: 'sep' }),
      h('b', {}, '足りない物を買って編成（自動購入）'),
      h('div', {}, '倉庫の物を使ったうえで、空いているスロットと足りない弾薬・医薬品をトレーダーから予算内で買って装備します。'),
      h('div', { class: 'mini' }, `所持金 ${fmt(P.money)} C ・ 予算`),
      chips,
      h('button', { class: 'btn primary', style: { width: '100%' }, onclick: () => {
        const r = PF.autoBuyLoadout(budget);
        this.inv.refresh(); this.refreshSide(); this.updateTop();
        m.close();
        if (r.bought.length) toast(`${fmt(r.spent)} C で購入：${r.bought.join('、')}`, 'good');
        else {
          const e = PF.profile().loadout.equip;
          const full = ['primary', 'armor', 'helmet', 'rig', 'backpack'].every((k) => e[k]);
          toast(full ? '装備・弾薬・医薬品はすでにそろっていて、買う物はなかった' : '予算内で買える物がなかった（予算を増やすか、レベルを上げると買える物が増える）', full ? 'good' : 'warn');
        }
      } }, '予算内で購入して編成する'),
    ), []);
  }

  ctxItems(ref, it) {
    const def = ITEMS[it.id];
    const out = [{ text: '詳細を見る', fn: () => this.inspect(ref, it) }];
    if (ref === 'stash') {
      const P = PF.profile();
      const slots = EQUIP_SLOTS.filter((s) => slotAccepts(s, def));
      for (const s of slots) out.push({ text: `装備する（${SLOT_NAMES[s]}）`, fn: () => {
        const cur = P.loadout.equip[s];
        const tmp = { equip: { ...P.loadout.equip, [s]: null } };
        if (!canEquip(tmp, s, it)) { toast('アーマーリグとボディアーマーは同時に装備できない', 'warn'); return; }
        removeItem(P.stash, it.uid);
        if (cur) { P.loadout.equip[s] = null; if (!autoInsert(P.stash, cur)) { P.loadout.equip[s] = cur; autoInsert(P.stash, it); toast('倉庫に空きがない', 'warn'); return; } }
        delete it.x; delete it.y; it.rot = false;
        P.loadout.equip[s] = it;
        PF.commit(); this.inv.refresh(); this.refreshSide();
      } });
    }
    if (def.weapon) out.push({ text: '武器をカスタマイズ', fn: () => this.weaponModal(ref, it) });
    if (def.weapon && it.mag?.count) out.push({ text: '弾を抜く', fn: () => { const P = PF.profile(); const root = ref === 'stash' ? P.stash : P.loadout; const a = createItem(it.mag.ammo, { count: it.mag.count }); it.mag.count = 0; if (!autoInsert(P.stash, a)) autoInsert(root, a); PF.commit(); this.inv.refresh(); } });
    if (def.weapon) {
      const P = PF.profile();
      const ammo = allItems(P.stash).concat(allItems(P.loadout)).filter((a) => ITEMS[a.id].cat === 'ammo' && ITEMS[a.id].ammo.caliber === def.weapon.caliber);
      const types = [...new Set(ammo.map((a) => a.id))];
      for (const t of types) out.push({ text: `装填: ${ITEMS[t].name}`, fn: () => this.loadWeapon(it, t) });
    }
    if (def.stack > 1 && it.count > 1) out.push({ text: '半分に分割', fn: () => { const P = PF.profile(); const root = ref === 'stash' ? P.stash : P.loadout; const n = Math.floor(it.count / 2); const part = createItem(it.id, { count: n }); if (autoInsert(P.stash, part)) { it.count -= n; PF.commit(); this.inv.refresh(); } else toast('空きがない', 'warn'); void root; } });
    const b = PF.bestTraderFor(it);
    if (b.price) out.push({ text: `売却 → ${b.trader.name}（${fmt(b.price)} C）`, fn: () => this.sell(ref, it, b.trader) });
    // 同じ種類が倉庫に複数あれば、まとめて売る
    if (b.price && ref === 'stash') {
      const g = PF.sellGroups().find((x) => x.id === it.id);
      if (g && g.sellable.length > 1) out.push({ text: `同じ物をすべて売却（${g.sellable.length} 個 ・ ${fmt(g.total)} C）`, fn: () => { const r = PF.sellMany(g.sellable.map((x) => x.uid)); toast(`${def.name} を ${r.count} 個、${fmt(r.total)} C で売却した`, 'good'); this.inv.refresh(); this.refreshSide(); this.updateTop(); } });
    }
    out.push({ text: '破棄', fn: async () => { if (await confirmBox('破棄', `${def.name} を破棄しますか？`, '破棄')) { const P = PF.profile(); removeItem(ref === 'stash' ? P.stash : P.loadout, it.uid); PF.commit(); this.inv.refresh(); } } });
    return out;
  }

  loadWeapon(w, ammoId) {
    const P = PF.profile();
    const cap = weaponStats(w).capacity;
    if (w.mag.count > 0 && w.mag.ammo !== ammoId) { autoInsert(P.stash, createItem(w.mag.ammo, { count: w.mag.count })); w.mag.count = 0; }
    w.mag.ammo = ammoId;
    let need = cap - w.mag.count;
    for (const root of [P.stash, P.loadout]) {
      for (const a of allItems(root)) {
        if (need <= 0) break;
        if (a.id !== ammoId) continue;
        const k = Math.min(need, a.count);
        a.count -= k; need -= k; w.mag.count += k;
        if (a.count <= 0) removeItem(root, a.uid);
      }
    }
    PF.commit(); this.inv.refresh();
  }

  sell(ref, it, trader) {
    if (!trader) return;
    const def = ITEMS[it.id];
    if (def.cat === 'secure') { toast('セキュアコンテナは売却できない', 'warn'); return; }
    const price = PF.sellItem(ref, it.uid, trader);
    if (price) toast(`${def.name} を ${fmt(price)} C で売却した`, 'good');
    else toast(`${trader.name} はこれを買い取らない`, 'warn');
    this.inv.refresh();
    this.refreshSide();
    if (this.tab === 'traders') this.renderShop?.();
  }

  inspect(ref, it) {
    const def = ITEMS[it.id];
    if (def.weapon) return this.weaponModal(ref, it);
    const C = cellSize();
    modal(def.name, h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '16px' } },
      h('div', { style: { width: def.w * C + 'px', height: def.h * C + 'px', backgroundImage: `url(${getItemIcon(def)})`, backgroundSize: '100% 100%', background: undefined, flexShrink: 0 } }),
      h('div', { style: { minWidth: '280px' } }, itemTooltip(it, {})),
    ));
  }

  weaponModal(ref, w) {
    const def = ITEMS[w.id];
    const C = cellSize();
    const body = h('div', {});
    const render = () => {
      body.innerHTML = '';
      const P = PF.profile();
      const st = weaponStats(w);
      const slots = def.weapon.slots;
      const icon = h('div', { style: { width: def.w * C * 1.4 + 'px', height: def.h * C * 1.4 + 'px', backgroundImage: `url(${getItemIcon(def)})`, backgroundSize: '100% 100%', margin: '0 auto' } });
      const slotEls = slots.map((s) => {
        const m = w.mods?.[s];
        const box = h('div', { class: 'slot', style: { width: 2 * C + 'px', height: 1.6 * C + 'px' }, dataset: { modslot: s, ref, weapon: w.uid } }, h('span', { class: 'slot-label' }, SLOT_JP[s]));
        if (m) {
          const el = h('div', { class: 'item', style: { position: 'relative', width: 2 * C - 8 + 'px', height: 1.6 * C - 8 + 'px', margin: '4px', backgroundImage: `url(${getItemIcon(ITEMS[m.id])})`, backgroundSize: 'contain', backgroundPosition: 'center', cursor: 'pointer' }, title: '' }, h('span', { class: 'lbl' }, ITEMS[m.id].short));
          el.addEventListener('mouseenter', (e) => showTooltip(itemTooltip(m, { hint: 'クリックで取り外し' }), e.clientX, e.clientY));
          el.addEventListener('mousemove', (e) => moveTooltip(e.clientX, e.clientY));
          el.addEventListener('mouseleave', hideTooltip);
          el.addEventListener('click', () => {
            hideTooltip();
            delete w.mods[s];
            if (s === 'mag') w.mag.count = Math.min(w.mag.count, weaponStats(w).capacity);
            if (!autoInsert(P.stash, m)) { w.mods[s] = m; toast('倉庫に空きがない', 'warn'); }
            PF.commit(); render(); this.inv.refresh();
          });
          box.append(el);
        }
        return box;
      });
      // 倉庫内の互換 MOD
      const avail = [];
      for (const [rref, root] of [['stash', P.stash], ['loadout', P.loadout]]) {
        for (const it of allItems(root, true)) {
          const md = ITEMS[it.id];
          if (md.cat === 'mod' && modFits(def, md) && it.uid !== w.uid) avail.push({ rref, it });
        }
      }
      const availEl = h('div', { class: 'col', style: { gap: '3px', maxHeight: '260px', overflow: 'auto' } },
        avail.length ? avail.map(({ rref, it }) => {
          const md = ITEMS[it.id];
          const occupied = !!w.mods?.[md.mod.slot];
          return h('div', { class: 'shop-row', style: { gridTemplateColumns: '40px 1fr auto' } },
            h('i', { class: 'ic', style: { width: '40px', height: '28px', backgroundImage: `url(${getItemIcon(md)})` } }),
            h('span', { class: 'nm' }, md.name, h('small', {}, SLOT_JP[md.mod.slot] + (md.mod.zoom ? ` ・ ${md.mod.zoom}x` : '') + (md.mod.recoil ? ` ・ 反動-${Math.round(md.mod.recoil * 100)}%` : ''))),
            h('button', { class: 'btn small', disabled: occupied, onclick: () => {
              const root = rref === 'stash' ? P.stash : P.loadout;
              const wroot = ref === 'stash' ? P.stash : P.loadout;
              if (applyOp(root, wroot, { uid: it.uid, target: { mod: w.uid, slot: md.mod.slot } })) { PF.commit(); render(); this.inv.refresh(); }
            } }, occupied ? '装着済' : '装着'));
        }) : h('div', { class: 'mini' }, '倉庫に互換性のあるMODがない。トレーダー「ヤン」から購入できる。'));
      const statRow = (k, v, max, color = '#5fae5a') => h('div', { style: { margin: '4px 0' } }, h('div', { class: 'row mini' }, k, h('span', { class: 'grow' }), h('b', { class: 'num', style: { color: '#ddd' } }, v)), h('div', { class: 'progress' }, h('i', { style: { width: Math.min(100, (parseFloat(v) / max) * 100) + '%', background: color } })));
      body.append(
        h('div', { class: 'row', style: { gap: '20px', alignItems: 'flex-start' } },
          h('div', { style: { width: '420px' } }, icon,
            h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px', marginTop: '10px', justifyContent: 'center' } }, slotEls),
            h('div', { class: 'mini', style: { textAlign: 'center', marginTop: '6px' } }, 'MOD を倉庫からスロットへドラッグ、またはクリックで取り外し')),
          h('div', { style: { width: '300px' } },
            h('div', { class: 'mini' }, CLASS_NAMES[def.weapon.class] + ' ・ ' + def.weapon.caliber),
            statRow('エルゴノミクス', Math.round(st.ergo), 100),
            statRow('縦反動', Math.round(st.recoilV * 100), 300, '#d0a040'),
            statRow('横反動', Math.round(st.recoilH * 100), 100, '#d0a040'),
            statRow('連射速度', st.rpm, 1200, '#4a90d0'),
            statRow('装弾数', st.capacity, 100, '#4a90d0'),
            h('div', { class: 'row mini' }, '照準倍率', h('span', { class: 'grow' }), h('b', {}, st.zoom.toFixed(1) + 'x')),
            h('div', { class: 'row mini' }, '消音', h('span', { class: 'grow' }), h('b', {}, st.suppressed ? 'あり' : 'なし')),
            h('div', { class: 'row mini' }, '価値', h('span', { class: 'grow' }), h('b', { class: 'num', style: { color: '#e8c26a' } }, fmt(itemValue(w)) + ' C')),
            h('div', { class: 'sep' }),
            h('div', { class: 'mini', style: { marginBottom: '4px' } }, '所持している互換 MOD'),
            availEl,
          ),
        ),
      );
    };
    render();
    // MOD スロットへのドラッグを受け付けるため、InvView の roots を利用
    modal(`${def.name} — カスタマイズ`, body, [], { onClose: () => this.inv.refresh() });
  }

  // ---------------------------------------------------------------- トレーダー
  pageTraders() {
    const list = h('div', { class: 'trader-list' });
    const shopWrap = h('div', { style: { minHeight: 0, height: '100%' } });
    this.filter = this.filter || { cat: 'all', q: '' };
    const renderList = () => {
      list.innerHTML = '';
      for (const t of TRADERS) {
        const cv = h('canvas', { class: 'portrait', width: 112, height: 112 });
        drawPortrait(cv, t);
        list.append(h('div', { class: 'trader-card' + (this.trader === t.id ? ' active' : ''), onclick: () => { this.trader = t.id; renderList(); this.renderShop(); } },
          cv, h('div', {}, h('div', { class: 'tn', style: { color: t.color } }, t.name), h('div', { class: 'tt' }, t.title), h('div', { class: 'mini', style: { marginTop: '3px' } }, t.desc))));
      }
    };
    this.renderShop = () => {
      const t = TRADERS.find((x) => x.id === this.trader);
      shopWrap.innerHTML = '';
      this.inv.mounts = this.inv.mounts.filter((m) => m.el.isConnected);
      const stock = PF.traderStock(t);
      const cats = [...new Set(stock.map((d) => d.cat))];
      const listEl = h('div', { class: 'shop-list' });
      const fill = () => {
        listEl.innerHTML = '';
        const q = this.filter.q.trim();
        for (const d of stock) {
          if (this.filter.cat !== 'all' && d.cat !== this.filter.cat) continue;
          if (q && !d.name.includes(q) && !d.short.includes(q)) continue;
          const price = PF.buyPrice(d);
          const n = PF.buyPack(d);
          const row = h('div', { class: 'shop-row' },
            h('i', { class: 'ic', style: { backgroundImage: `url(${getItemIcon(d)})` } }),
            h('span', { class: 'nm', style: { color: RARITY_COLORS[d.rarity] } }, d.name + (n > 1 ? ` ×${n}` : ''), h('small', {}, `${CAT_NAMES[d.cat]} ・ ${d.w}×${d.h}`)),
            h('span', { class: 'pr' }, fmt(price) + ' C'),
            h('button', { class: 'btn small primary', disabled: PF.profile().money < price, onclick: () => { const r = PF.buyItem(d); if (r.ok) { toast(`${d.name} を購入した`, 'good'); this.inv.refresh(); fill(); } else toast(r.msg, 'warn'); } }, '購入'));
          const fake = createItem(d.id, { count: n });
          row.addEventListener('mouseenter', (e) => showTooltip(itemTooltip(fake, {}), e.clientX, e.clientY));
          row.addEventListener('mousemove', (e) => moveTooltip(e.clientX, e.clientY));
          row.addEventListener('mouseleave', hideTooltip);
          listEl.append(row);
        }
      };
      fill();
      const filterRow = h('div', { class: 'filter-row' },
        h('span', { class: 'chip' + (this.filter.cat === 'all' ? ' active' : ''), onclick: () => { this.filter.cat = 'all'; this.renderShop(); } }, 'すべて'),
        cats.map((c) => h('span', { class: 'chip' + (this.filter.cat === c ? ' active' : ''), onclick: () => { this.filter.cat = c; this.renderShop(); } }, CAT_NAMES[c])),
        h('input', { class: 'search', placeholder: '検索…', value: this.filter.q, oninput: (e) => { this.filter.q = e.target.value; fill(); } }),
      );
      const sellInv = new InvView({
        roots: () => ({ stash: PF.profile().stash }),
        apply: (s, d, op) => this.applyLocal(s, d, op),
        contextItems: (ref, it) => [{ text: `売却（${fmt(PF.sellPrice(it, t))} C）`, fn: () => { this.sell(ref, it, t); sellInv.refresh(); } }],
        quickTarget: () => null,
        tooltipExtra: (ref, it) => ({ price: PF.sellPrice(it, t), priceLabel: `${t.name} の買取額`, hint: '右クリック / Alt+クリックで売却' }),
        onDropOutside: (ref, it, ev) => { if (ev.target?.closest?.('.sell-zone')) { this.sell(ref, it, t); sellInv.refresh(); } },
      });
      const sellGrid = sellInv.gridRoot('stash');
      sellGrid.addEventListener('click', (e) => {
        if (!e.altKey) return;
        const el = e.target.closest('.item'); if (!el) return;
        const f = findItem(PF.profile().stash, el.dataset.uid); if (f) { this.sell('stash', f.item, t); sellInv.refresh(); }
      });
      shopWrap.append(h('div', { class: 'shop' },
        h('div', { class: 'panel', style: { display: 'flex', flexDirection: 'column', minHeight: 0 } }, h('div', { class: 'panel-h' }, `${t.name} — 購入`, h('span', { class: 'sub' }, `レベル ${PF.level()} で購入可能な品`)), filterRow, listEl),
        h('div', { class: 'panel', style: { display: 'flex', flexDirection: 'column', minHeight: 0 } },
          h('div', { class: 'panel-h' }, `${t.name} — 売却`, h('span', { class: 'sub' }, '倉庫のアイテム')),
          h('div', { class: 'sell-zone', dataset: { trader: t.id }, style: { margin: '8px', border: '1px dashed ' + t.color, padding: '12px', textAlign: 'center', color: t.color, fontSize: '13px' } }, 'ここにドロップして売却 ／ 右クリックで売却'),
          h('div', { class: 'inv-scroll', style: { padding: '0 8px 8px' } }, sellGrid)),
      ));
    };
    renderList();
    this.renderShop();
    return h('div', { class: 'page' }, h('div', { class: 'traders' }, list, shopWrap));
  }

  // ---------------------------------------------------------------- ハイドアウト
  pageHideout() {
    const page = h('div', { class: 'page' });
    const P = PF.profile();
    const grid = h('div', { class: 'stations' });
    this.progressEls = [];
    for (const [sid, S] of Object.entries(STATIONS)) {
      const lvl = PF.stationLevel(sid);
      const cost = PF.upgradeCost(sid);
      const card = h('div', { class: 'panel station' });
      card.append(h('div', { class: 'panel-h' }, S.icon + ' ' + S.name, h('span', { class: 'sub' }, 'レベル ', h('span', { class: 'lv' }, lvl), ' / ', S.money.length)));
      const b = h('div', { class: 'panel-b' });
      if (cost) {
        b.append(h('div', { class: 'mini' }, lvl ? '次のレベルへの強化' : '建設に必要なもの'),
          h('div', { class: 'ing' }, ingChip('credits_money', cost.money, P.money >= cost.money), cost.items.map(([id, n]) => ingChip(id, n, PF.countInStash(id) >= n))),
          h('button', { class: 'btn small primary', style: { marginTop: '6px' }, disabled: !PF.canUpgrade(sid), onclick: () => { if (PF.upgradeStation(sid)) { toast(`${S.name} を強化した`, 'good'); this.build(); } } }, lvl ? '強化' : '建設'));
        if (sid === 'stash') b.append(h('div', { class: 'mini', style: { marginTop: '4px' } }, `倉庫の行数 +${S.rows[lvl]}`));
      } else b.append(h('div', { class: 'mini' }, '最大レベル'));
      if (lvl > 0) {
        const active = P.crafts.find((c) => c.station === sid);
        if (active) {
          const r = RECIPES.find((x) => x.id === active.recipe);
          const prog = h('i', {});
          const label = h('span', { class: 'num' });
          const btns = h('div', { class: 'row', style: { marginTop: '6px' } });
          this.progressEls.push({ c: active, prog, label, btns, r });
          b.append(h('div', { class: 'sep' }), h('div', { class: 'row' }, h('i', { class: 'ic', style: { width: '40px', height: '32px', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundImage: `url(${getItemIcon(ITEMS[r.out[0][0]])})` } }), h('b', {}, `${ITEMS[r.out[0][0]].name} ×${r.out[0][1]}`), h('span', { class: 'grow' }), label), h('div', { class: 'progress', style: { marginTop: '4px' } }, prog), btns);
        }
        for (const r of PF.recipesFor(sid)) {
          const out = ITEMS[r.out[0][0]];
          const ok = PF.canCraft(r);
          b.append(h('div', { class: 'recipe' },
            h('div', {},
              h('div', { class: 'row' }, h('b', { style: { color: RARITY_COLORS[out.rarity] } }, `${out.name} ×${r.out[0][1]}`), r.lvl > lvl ? h('span', { class: 'tag' }, `要Lv${r.lvl}`) : null),
              h('div', { class: 'ing' }, r.in.map(([id, n]) => ingChip(id, n, PF.countInStash(id) >= n))),
              h('div', { class: 'mini' }, `所要時間 ${fmtDur(r.time * PF.CRAFT_SPEED)}` + (r.keep ? '（GPUは消費しない）' : ''))),
            h('button', { class: 'btn small', disabled: !ok, onclick: () => { if (PF.startCraft(r)) { toast('製作を開始した', 'good'); this.build(); } } }, '製作')));
        }
      }
      card.append(b);
      grid.append(card);
    }
    page.append(grid);
    this.refreshHideoutProgress();
    return page;
  }
  refreshHideoutProgress() {
    for (const p of this.progressEls || []) {
      const { c, prog, label, btns, r } = p;
      const t = Math.min(1, (Date.now() - c.start) / (c.end - c.start));
      prog.style.width = t * 100 + '%';
      const left = Math.max(0, (c.end - Date.now()) / 1000);
      label.textContent = left > 0 ? fmtDur(left) : '完成';
      const want = left > 0 ? 'wait' : 'done';
      if (btns.dataset.st !== want) {
        btns.dataset.st = want;
        btns.innerHTML = '';
        if (left > 0) btns.append(h('button', { class: 'btn small', onclick: () => { if (PF.skipCraft(c)) this.build(); else toast('クレジットが足りない', 'warn'); } }, `即時完成（${fmt(PF.skipCraftCost(c))} C）`));
        else btns.append(h('button', { class: 'btn small primary', onclick: () => { if (PF.collectCraft(c)) { toast(`${ITEMS[r.out[0][0]].name} を受け取った`, 'good'); this.build(); } else toast('倉庫に空きがない', 'warn'); } }, '受け取る'));
      }
    }
  }

  // ---------------------------------------------------------------- クエスト
  pageQuests() {
    const page = h('div', { class: 'page' });
    const grid = h('div', { class: 'quests' });
    const order = { active: 0, available: 1, done: 2, locked: 3 };
    const qs = [...QUESTS].sort((a, b) => order[PF.questState(a)] - order[PF.questState(b)]);
    for (const q of qs) {
      const st = PF.questState(q);
      const tr = TRADERS.find((t) => t.id === q.trader);
      const card = h('div', { class: 'panel quest' + (st === 'locked' ? ' locked' : '') });
      card.append(
        h('div', { class: 'row' }, h('h3', {}, q.name), h('span', { class: 'grow' }), h('span', { class: 'badge ' + st }, { active: '進行中', available: '受注可能', done: '完了', locked: 'ロック' }[st])),
        h('div', { class: 'qt', style: { color: tr.color } }, `依頼者: ${tr.name}（${tr.title}）`),
        h('div', { class: 'mini', style: { margin: '6px 0' } }, q.desc),
        ...q.obj.map((o, i) => {
          const pr = st === 'active' ? PF.objProgress(q, i) : st === 'done' ? o.count : 0;
          return h('div', { class: 'obj' + (pr >= o.count ? ' done' : '') }, h('span', {}, (pr >= o.count ? '✔ ' : '◻ ') + o.text), h('span', { class: 'num' }, o.type === 'loot_value' ? (pr >= o.count ? '達成' : '') : `${fmt(pr)}/${fmt(o.count)}`));
        }),
        h('div', { class: 'sep' }),
        h('div', { class: 'mini' }, '報酬: ', [q.reward.money ? `${fmt(q.reward.money)} C` : null, q.reward.xp ? `${fmt(q.reward.xp)} XP` : null, ...(q.reward.items || []).map(([id, n]) => `${ITEMS[id].name}${n > 1 ? '×' + n : ''}`), q.reward.unlockStation ? `ハイドアウト「${STATIONS[q.reward.unlockStation].name}」解放` : null].filter(Boolean).join('、')),
        h('div', { class: 'row', style: { marginTop: '8px' } },
          st === 'available' ? h('button', { class: 'btn small primary', onclick: () => { PF.acceptQuest(q); toast(`タスク「${q.name}」を受注した`); this.build(); } }, '受注') : null,
          st === 'active' ? h('button', { class: 'btn small primary', disabled: !PF.questComplete(q), onclick: () => { if (PF.turnInQuest(q)) { toast(`タスク「${q.name}」完了！`, 'good'); this.build(); } } }, '報告・納品') : null,
          q.obj.some((o) => o.type === 'find') && st === 'active' ? h('span', { class: 'mini' }, '※納品できるのはレイド内で入手（✔印）した物だけ。倉庫と装備のどちらに入っていても数える') : null),
      );
      grid.append(card);
    }
    page.append(grid);
    return page;
  }

  // ---------------------------------------------------------------- 出撃
  pageDeploy() {
    const o = this.deployOpts;
    const P = PF.profile();
    const save = () => { try { localStorage.setItem('rb-deploy', JSON.stringify(o)); } catch { /* noop */ } };
    const opt = (key, val, title, sub) => h('div', { class: 'opt' + (o[key] === val ? ' active' : ''), onclick: () => { o[key] = val; save(); this.build(); } }, h('b', {}, title), h('small', {}, sub));
    const lo = P.loadout;
    const warns = [];
    if (!lo.equip.primary && !lo.equip.secondary && !lo.equip.holster) warns.push('武器を装備していない！');
    const w = lo.equip.primary || lo.equip.secondary || lo.equip.holster;
    if (w && !w.mag?.count) warns.push('武器に弾が入っていない（倉庫で右クリック →「装填」）');
    if (!lo.equip.armor && !(lo.equip.rig && ITEMS[lo.equip.rig.id].armor)) warns.push('アーマーを装備していない');
    if (!allItems(lo).some((i) => ITEMS[i.id].cat === 'med')) warns.push('医薬品を持っていない');
    const mapCv = h('canvas', { width: 900, height: 440 });
    setTimeout(() => drawMapPreview(mapCv), 0);
    const left = h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, '出撃設定'), h('div', { class: 'panel-b' },
      h('div', { class: 'opt-group' }, h('label', { class: 'h' }, 'モード'), h('div', { class: 'opts' },
        opt('mode', 'offline', 'オールNPC', '他の「レイダー」も全員AI。ソロで遊べるPvPvE。'),
        OFFLINE_ONLY ? h('div', { class: 'opt', style: { opacity: 0.5, cursor: 'default' } }, h('b', {}, 'オンライン PvPvE'), h('small', {}, 'このページ版では使えません。サーバー版（npm start）で遊べます。')) : opt('mode', 'online', 'オンライン PvPvE', 'サーバーに接続し、他プレイヤー＋AIと同じレイドに参加する。'))),
      h('div', { class: 'opt-group' }, h('label', { class: 'h' }, '難易度'), h('div', { class: 'opts' },
        opt('difficulty', 'normal', 'ノーマル', '出血・骨折・部位欠損あり。本来のバランス。'),
        opt('difficulty', 'easy', 'イージー', '自分が受けるダメージ 1/4。出血・骨折・部位欠損なし。'))),
      o.mode === 'online' ? h('div', { class: 'opt-group' }, h('label', { class: 'h' }, 'サーバーアドレス'),
        h('input', { class: 'search', style: { width: '100%', padding: '8px' }, value: P.settings.serverUrl || defaultServer(), placeholder: 'ws://localhost:8080', oninput: (e) => { P.settings.serverUrl = e.target.value; PF.save(); } }),
        h('div', { class: 'mini', style: { marginTop: '4px' } }, '同じサーバーに接続したプレイヤーは同じレイドに入る（レイド進行中は途中参加）。')) : null,
      h('div', { class: 'opt-group' }, h('label', { class: 'h' }, '時間帯'), h('div', { class: 'opts' },
        opt('timeOfDay', 'day', '昼', '視界良好'), opt('timeOfDay', 'dusk', '夕暮れ', '視界やや悪い'), opt('timeOfDay', 'night', '夜', 'ライト必須。敵の索敵範囲も狭い'))),
      o.mode === 'offline' ? h('div', { class: 'opt-group' }, h('label', { class: 'h' }, 'AI レイダーの数'), h('div', { class: 'opts' },
        opt('raiders', 5, '少ない', '5 人'), opt('raiders', 9, '標準', '9 人'), opt('raiders', 14, '多い', '14 人'))) : null,
      o.mode === 'offline' ? h('div', { class: 'opt-group' }, h('label', { class: 'h' }, 'スカブ・ARC 機械の密度'), h('div', { class: 'opts' },
        opt('density', 'low', '低', '探索重視'), opt('density', 'normal', '標準', ''), opt('density', 'high', '高', '激戦'))) : null,
      o.mode === 'offline' ? h('div', { class: 'opt-group' }, h('label', { class: 'h' }, 'レイド時間'), h('div', { class: 'opts' },
        opt('duration', 20, '20 分', ''), opt('duration', 30, '30 分', ''), opt('duration', 45, '45 分', ''))) : null,
      warns.map((t) => h('div', { class: 'warn-box' }, '⚠ ' + t)),
      h('div', { style: { marginTop: '16px', textAlign: 'center' } }, h('button', { class: 'btn primary big', onclick: () => this.onDeploy({ ...o, serverUrl: P.settings.serverUrl || defaultServer() }) }, '出 撃')),
    ));
    const right = h('div', { class: 'col' },
      h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, 'マップ: グレイヴ港湾区', h('span', { class: 'sub' }, '400m × 400m')), h('div', { class: 'mapcard' }, mapCv)),
      h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, 'ブリーフィング'), h('div', { class: 'panel-b mini', style: { lineHeight: 1.7 } },
        '旧港湾区は ARC 機械の墜落以来、封鎖地帯になった。残された物資を漁り、脱出地点から生還せよ。', h('br'),
        '・スカブ（現地民）、ARC 機械、他のレイダーが徘徊している。', h('br'),
        '・脱出地点は「O」キーで確認。条件付きの脱出地点もある（電源・料金・キーカード）。', h('br'),
        '・死亡すると持ち込んだ装備と戦利品を失う。セキュアコンテナの中身だけは守られる。', h('br'),
        '・軍事基地には司令官グロムと護衛がいる。研究所はセンチネルが守っている。')),
      h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, '操作方法'), h('div', { class: 'panel-b' }, helpKeys())),
    );
    return h('div', { class: 'page' }, h('div', { class: 'deploy' }, left, right));
  }

  // ---------------------------------------------------------------- 記録
  pageRecords() {
    const P = PF.profile();
    const s = P.stats;
    const st = (k, v) => h('div', { class: 'st panel', style: { padding: '12px', textAlign: 'center' } }, h('div', { class: 'big-num' }, v), h('div', { class: 'mini' }, k));
    const surv = s.raids ? Math.round((s.survived / s.raids) * 100) : 0;
    return h('div', { class: 'page' },
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '14px' } },
        st('レイド数', s.raids || 0), st('生還', s.survived || 0), st('生還率', surv + '%'), st('死亡', s.deaths || 0), st('MIA', s.mia || 0),
        st('総キル', s.kills || 0), st('レイダー撃破', s.pmcKills || 0), st('スカブ撃破', s.scavKills || 0), st('ARC 撃破', s.machineKills || 0), st('ボス撃破', s.bossKills || 0),
        st('持ち帰った価値', fmt(s.lootValue || 0)), st('売却総額', fmt(s.totalEarned || 0))),
      h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, 'レイド履歴'), h('div', { class: 'panel-b' },
        P.history.length ? P.history.map((r) => h('div', { class: 'history-row' },
          h('span', { style: { color: r.survived ? '#8ad070' : '#d24a3a', fontWeight: 700 } }, r.survived ? '生還' : r.mia ? 'MIA' : '死亡'),
          h('span', {}, r.survived ? `脱出: ${r.ex}` : `${r.killer || ''}`, h('span', { class: 'mini' }, `  ・ キル ${r.kills} ・ +${fmt(r.xp)} XP`)),
          h('span', { class: 'num', style: { color: r.gained >= 0 ? '#8ad070' : '#d24a3a' } }, (r.gained >= 0 ? '+' : '') + fmt(r.gained) + ' C'))) : h('div', { class: 'mini' }, 'まだレイドの記録がない'))),
      h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn small', onclick: () => this.onPlayers() }, 'プレイヤー切り替え ／ 最初からやり直す')),
    );
  }
}

export function defaultServer() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const port = location.port === '5173' ? '8080' : location.port;
  return `${proto}//${location.hostname}${port ? ':' + port : ''}/ws`;
}

function ingChip(id, n, ok) {
  if (id === 'credits_money') return h('span', { class: 'ing-chip ' + (ok ? 'ok' : 'no') }, h('i', { style: { backgroundImage: `url(${getItemIcon(ITEMS.credits)})` } }), fmt(n) + ' C');
  const d = ITEMS[id];
  if (!d) return h('span', { class: 'ing-chip no' }, id);
  const have = PF.countInStash(id);
  const el = h('span', { class: 'ing-chip ' + (ok ? 'ok' : 'no') }, h('i', { style: { backgroundImage: `url(${getItemIcon(d)})` } }), `${d.short} ${have}/${n}`);
  el.addEventListener('mouseenter', (e) => showTooltip(itemTooltip(createItem(id), {}), e.clientX, e.clientY));
  el.addEventListener('mousemove', (e) => moveTooltip(e.clientX, e.clientY));
  el.addEventListener('mouseleave', hideTooltip);
  return el;
}
function fmtDur(s) {
  s = Math.ceil(s);
  const hh = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return hh ? `${hh}時間${m}分` : m ? `${m}分${ss}秒` : `${ss}秒`;
}

export function helpKeys() {
  if (matchMedia('(pointer: coarse)').matches) {
    const t = [['左下をドラッグ', '移動（前に倒し切るとダッシュ）'], ['右側をスワイプ', '視点'], ['射撃ボタン', '押しながらスライドで照準も動く'], ['ADS', 'エイム切替'], ['R / ▲ / ▼', 'リロード / ジャンプ / しゃがみ'], ['◀ ▶', 'リーン'], ['⇄ / 💣 / ✚', '武器切替 / 手榴弾 / 自動回復'], ['漁る・拾う', '対象に近づくと表示'], ['下部スロット', 'タップで医薬品・投擲物を使用'], ['上部ボタン', '一時停止・バッグ・マップ・脱出地点・ライト・射撃モード・倍率'], ['バッグ内', 'タップでメニュー、ドラッグで移動（もう一本の指で回転）']];
    return h('div', { class: 'help-keys' }, t.map(([a, b]) => [h('kbd', {}, a), h('span', {}, b)]));
  }
  const k = [['WASD', '移動'], ['Shift', 'ダッシュ'], ['C / Ctrl', 'しゃがみ'], ['Space', 'ジャンプ'], ['Q / E', 'リーン'], ['左クリック', '射撃'], ['右クリック', 'エイム（ADS）'], ['R', 'リロード'], ['B', '射撃モード切替'], ['1 / 2 / 3', 'メイン / サブ / ピストル'], ['4〜9', 'クイックスロット（医薬品・投擲物）'], ['G', '手榴弾を投げる'], ['F', 'インタラクト（漁る・扉・拾う）'], ['Tab', 'インベントリ'], ['O', '脱出地点の確認'], ['T', 'ライト ON/OFF'], ['V', 'スコープ倍率切替'], ['H', '体力の確認（自動回復アイテム使用）'], ['M', 'マップ'], ['Esc', 'メニュー']];
  return h('div', { class: 'help-keys' }, k.map(([a, b]) => [h('kbd', {}, a), h('span', {}, b)]));
}
void listGrids;
