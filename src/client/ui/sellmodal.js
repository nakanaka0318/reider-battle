// まとめて売却：倉庫のアイテムを種類ごとに選んで、それぞれ一番高く買うトレーダーへ一括で売る
import { h, modal, toast, fmt } from './dom.js';
import { CAT_NAMES, RARITY_COLORS } from '../../shared/items.js';
import { getItemIcon } from '../icons.js';
import * as PF from '../profile.js';

// 最初から選んでおく分類（戦利品として売るのが普通の物）。反重力装置は持っているだけで役に立つので除く
const LOOT_CATS = new Set(['barter', 'valuable', 'intel', 'machine']);
const isLoot = (g) => LOOT_CATS.has(g.def.cat) && !g.def.carry;

// opts.raidUids: 今回のレイドで持ち帰ったアイテムの uid（あればそれだけを最初に選ぶ）
export function sellModal(onDone, opts = {}) {
  const raid = opts.raidUids ? new Set(opts.raidUids) : null;
  let groups = PF.sellGroups();
  const fromRaid = (g) => raid && g.items.some((it) => raid.has(it.uid));
  const sel = new Set(groups.filter((g) => (raid ? fromRaid(g) : isLoot(g))).map((g) => g.id));
  let cat = raid ? 'raid' : 'all';
  const list = h('div', { class: 'col', style: { gap: '2px', maxHeight: '52vh', overflowY: 'auto', paddingRight: '4px' } });
  const chips = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px', marginBottom: '6px' } });
  const quick = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px', marginBottom: '6px' } });
  const sumEl = h('b', { class: 'grow' });
  const sellBtn = h('button', { class: 'btn primary', onclick: () => doSell() }, '売却');

  const visible = () => groups.filter((g) => cat === 'all' || (cat === 'raid' ? fromRaid(g) : g.def.cat === cat));
  const updateSum = () => {
    const chosen = groups.filter((g) => sel.has(g.id));
    const total = chosen.reduce((n, g) => n + g.total, 0);
    sumEl.textContent = chosen.length ? `${chosen.length} 種 ・ 合計 ${fmt(total)} C` : '売る物を選んでください';
    sellBtn.disabled = !chosen.length;
    sellBtn.textContent = chosen.length ? `${fmt(total)} C で売却` : '売却';
  };
  const render = () => {
    chips.innerHTML = '';
    const cats = [...new Set(groups.map((g) => g.def.cat))];
    const chip = (key, label) => h('span', { class: 'chip' + (cat === key ? ' active' : ''), onclick: () => { cat = key; render(); } }, label);
    if (raid) chips.append(chip('raid', '今回の戦利品'));
    chips.append(chip('all', 'すべて'), ...cats.map((c) => chip(c, CAT_NAMES[c] || c)));
    list.innerHTML = '';
    const vis = visible();
    if (!vis.length) list.append(h('div', { class: 'mini', style: { padding: '12px', textAlign: 'center' } }, '売れるアイテムがない'));
    for (const g of vis) {
      const cb = h('input', { type: 'checkbox', checked: sel.has(g.id), style: { width: '20px', height: '20px' } });
      const row = h('label', { class: 'shop-row', style: { gridTemplateColumns: '24px 44px 1fr auto', cursor: 'pointer', alignItems: 'center' } },
        cb,
        h('i', { class: 'ic', style: { width: '44px', height: '34px', backgroundImage: `url(${getItemIcon(g.def)})` } }),
        h('span', { class: 'nm', style: { color: RARITY_COLORS[g.def.rarity] } }, `${g.def.name}${g.count > 1 ? ` ×${fmt(g.count)}` : ''}`,
          h('small', {}, `${CAT_NAMES[g.def.cat] || ''} ・ 売り先：${g.traders.join('・')}${g.reserved ? ` ・ 納品用に ${g.reserved} 個残す` : ''}`)),
        h('span', { class: 'pr' }, fmt(g.total) + ' C'));
      cb.addEventListener('change', () => { if (cb.checked) sel.add(g.id); else sel.delete(g.id); updateSum(); });
      list.append(row);
    }
    updateSum();
  };
  const setVisible = (on) => { for (const g of visible()) { if (on) sel.add(g.id); else sel.delete(g.id); } render(); };
  quick.append(
    h('button', { class: 'btn small', onclick: () => { sel.clear(); for (const g of groups) if (isLoot(g)) sel.add(g.id); render(); } }, 'おすすめ（戦利品）を選ぶ'),
    h('button', { class: 'btn small', onclick: () => setVisible(true) }, '表示中をすべて選ぶ'),
    h('button', { class: 'btn small', onclick: () => setVisible(false) }, '表示中の選択を外す'));

  const doSell = () => {
    const uids = groups.filter((g) => sel.has(g.id)).flatMap((g) => g.sellable.map((it) => it.uid));
    if (!uids.length) return;
    const r = PF.sellMany(uids);
    toast(`${r.count} 個を ${fmt(r.total)} C で売却した`, 'good');
    groups = PF.sellGroups();
    sel.clear();
    render();
    onDone?.();
  };

  const body = h('div', { style: { width: 'min(640px, 90vw)' } },
    h('div', { class: 'mini', style: { marginBottom: '6px', lineHeight: 1.6 } },
      'チェックした種類をまとめて、それぞれ一番高く買うトレーダーに売ります。進行中タスクの納品に必要な ✔ アイテムは自動で残します。'),
    h('div', { class: 'row', style: { gap: '8px', marginBottom: '8px', padding: '6px 8px', background: '#181c1e', border: '1px solid var(--line)' } }, sumEl, sellBtn),
    quick, chips, list);
  render();
  modal('まとめて売却', body, [{ text: '閉じる' }]);
}
