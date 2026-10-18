// オークション：素材・鍵などを割高で手に入れる。入札して他の入札者と競るか、即決で買う
import { h, toast, fmt, showTooltip, moveTooltip, hideTooltip } from './dom.js';
import { itemTooltip } from './itemtip.js';
import { ITEMS, RARITY_COLORS, CAT_NAMES, createItem } from '../../shared/items.js';
import { getItemIcon } from '../icons.js';
import * as PF from '../profile.js';

const left = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}分${String(s % 60).padStart(2, '0')}秒` : `${s}秒`;
};

// 戻り値：{ el, tick }。tick は毎秒呼んで残り時間と価格を更新する
function buildAuction(onChange) {
  const page = h('div', {});
  const grid = h('div', { class: 'market-grid' });
  const head = h('div', { class: 'panel', style: { marginBottom: '10px' } });
  const cards = new Map();

  const act = (r) => { toast(r.msg, r.ok ? 'good' : 'warn'); onChange?.(); render(); };
  const card = (lot) => {
    const d = ITEMS[lot.item];
    const els = { price: h('b', { class: 'num' }), who: h('span', { class: 'tag' }), time: h('span', { class: 'mini' }), bid: h('button', { class: 'btn small' }), buy: h('button', { class: 'btn small primary' }) };
    const ic = h('i', { class: 'ic', style: { width: '64px', height: '48px', backgroundImage: `url(${getItemIcon(d)})`, flex: '0 0 auto' } });
    ic.addEventListener('mouseenter', (e) => showTooltip(itemTooltip(createItem(d.id, { count: lot.count }), {}), e.clientX, e.clientY));
    ic.addEventListener('mousemove', (e) => moveTooltip(e.clientX, e.clientY));
    ic.addEventListener('mouseleave', hideTooltip);
    els.bid.addEventListener('click', () => act(PF.placeBid(lot.id, PF.lotMinBid(lot))));
    els.buy.addEventListener('click', () => act(PF.buyoutLot(lot.id)));
    const el = h('div', { class: 'panel', style: { padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' } },
      h('div', { class: 'row', style: { gap: '10px', alignItems: 'flex-start' } }, ic,
        h('div', { class: 'grow' },
          h('b', { style: { color: RARITY_COLORS[d.rarity] } }, d.name, lot.count > 1 ? ` ×${lot.count}` : ''),
          h('div', { class: 'mini' }, `${CAT_NAMES[d.cat] || ''} ・ 相場 ${fmt(lot.value)} C`))),
      h('div', { class: 'row' }, h('span', { class: 'mini' }, '現在価格'), h('span', { class: 'grow' }), els.price),
      h('div', { class: 'row' }, els.who, h('span', { class: 'grow' }), els.time),
      h('div', { class: 'row', style: { gap: '6px' } }, els.bid, els.buy));
    return { el, els, lot };
  };
  const update = () => {
    const now = Date.now(), P = PF.profile();
    for (const c of cards.values()) {
      const { lot, els } = c;
      const price = PF.lotPrice(lot, now), min = PF.lotMinBid(lot, now);
      const mine = lot.lead === 'you';
      els.price.textContent = `${fmt(price)} C`;
      els.price.style.color = price > lot.value ? '#e0a050' : '#8ad070';
      els.who.textContent = mine ? 'あなたが最高入札者' : lot.lead === 'npc' ? '他の入札者がリード' : '入札なし';
      els.who.style.color = mine ? '#8ad070' : '';
      els.time.textContent = `残り ${left(lot.ends - now)}`;
      els.time.style.color = lot.ends - now < 60000 ? '#ff7060' : '';
      els.bid.textContent = mine ? `入札中（${fmt(lot.bid)} C）` : `入札 ${fmt(min)} C`;
      els.bid.disabled = mine || P.money < min;
      els.buy.textContent = `即決 ${fmt(lot.buyout)} C`;
      els.buy.disabled = P.money + (mine ? lot.bid : 0) < lot.buyout;
    }
  };
  const render = () => {
    const won = PF.updateMarket();
    if (won.length) { toast(`落札した：${won.join('、')}（倉庫へ）`, 'good'); onChange?.(); }
    const M = PF.profile().market;
    head.innerHTML = '';
    head.append(h('div', { class: 'panel-h' }, 'オークション', h('span', { class: 'sub' }, 'トレーダーが扱わない素材・鍵・キーカードも出品される')),
      h('div', { class: 'panel-b mini', style: { lineHeight: 1.7 } },
        '・「入札」すると他の入札者と競り合う。締め切り時にあなたが最高入札者なら落札（倉庫に届く）。他の入札者に上回られたらお金は戻る。', h('br'),
        '・「即決」は相場の約 2 倍。すぐに手に入る。', h('br'),
        '・出品は時間がたつと終わり、新しい物に入れ替わる（実時間）。オークションで買った物は ✔ 印なし（納品には使えない）。',
        M.pending?.length ? h('div', { style: { marginTop: '6px' } }, h('button', { class: 'btn small primary', onclick: () => { const n = PF.claimPending(); toast(n ? `${n} 件を倉庫に入れた` : '倉庫に空きがない', n ? 'good' : 'warn'); onChange?.(); render(); } }, `受け取り待ち ${M.pending.length} 件を倉庫へ`)) : null));
    // 出品が入れ替わったときだけカードを作り直す
    const ids = new Set(M.lots.map((l) => l.id));
    for (const id of [...cards.keys()]) if (!ids.has(id)) { cards.get(id).el.remove(); cards.delete(id); }
    for (const lot of M.lots) {
      const c = cards.get(lot.id);
      if (c) c.lot = lot;
      else { const n = card(lot); cards.set(lot.id, n); grid.append(n.el); }
    }
    update();
  };
  page.append(head, grid);
  render();
  let last = 0;
  const tick = () => {
    const now = Date.now();
    if (PF.profile().market.lots.some((l) => now >= l.ends) || now - last > 10000) { last = now; render(); } else update();
  };
  return { el: page, tick };
}

// ---------------------------------------------------------------- 取り寄せ：素材をいつでも割高で買える
function buildImport(onChange) {
  const el = h('div', {});
  const defs = PF.materialDefs();
  let q = '', cat = 'used';
  const list = h('div', { class: 'col', style: { gap: '2px' } });
  const chips = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px', margin: '6px 0' } });
  const search = h('input', { class: 'search', placeholder: '名前で検索', style: { flex: 1, padding: '8px', minWidth: '160px' } });
  search.addEventListener('input', () => { q = search.value.trim(); renderList(); });
  const cats = [...new Set(defs.map((d) => d.cat))];
  const renderChips = () => {
    chips.innerHTML = '';
    const chip = (key, label) => h('span', { class: 'chip' + (cat === key ? ' active' : ''), onclick: () => { cat = key; renderChips(); renderList(); } }, label);
    chips.append(chip('used', 'クラフト・強化の素材'), chip('all', 'すべて'), ...cats.map((c) => chip(c, CAT_NAMES[c] || c)));
  };
  const row = (d) => {
    const price = PF.importPrice(d);
    const have = h('span', {});
    const upd = () => { have.textContent = ` ・ 倉庫に ${PF.countInStash(d.id)} 個`; };
    const buy = (n) => () => {
      const r = PF.buyImport(d.id, n);
      if (r.got) toast(`${d.name} を ${r.got} 個、${fmt(r.spent)} C で取り寄せた${r.why ? `（${r.why}）` : ''}`, 'good');
      else toast(r.why, 'warn');
      upd(); onChange?.();
    };
    upd();
    const ic = h('i', { class: 'ic', style: { width: '44px', height: '34px', backgroundImage: `url(${getItemIcon(d)})` } });
    ic.addEventListener('mouseenter', (e) => showTooltip(itemTooltip(createItem(d.id), {}), e.clientX, e.clientY));
    ic.addEventListener('mousemove', (e) => moveTooltip(e.clientX, e.clientY));
    ic.addEventListener('mouseleave', hideTooltip);
    return h('div', { class: 'shop-row', style: { gridTemplateColumns: '44px 1fr auto', alignItems: 'center' } }, ic,
      h('span', { class: 'nm', style: { color: RARITY_COLORS[d.rarity] } }, d.name,
        h('small', {}, `${CAT_NAMES[d.cat] || ''} ・ 相場 ${fmt(PF.importPrice(d) / PF.IMPORT_MARKUP)} C${defs.used.has(d.id) ? ' ・ 素材' : ''}`, have)),
      h('span', { class: 'row', style: { gap: '4px' } },
        h('button', { class: 'btn small primary', onclick: buy(1) }, `${fmt(price)} C`),
        h('button', { class: 'btn small', onclick: buy(5) }, '×5')));
  };
  const renderList = () => {
    list.innerHTML = '';
    const ql = q.toLowerCase();
    const shown = defs.filter((d) => (cat === 'all' || (cat === 'used' ? defs.used.has(d.id) : d.cat === cat)) && (!ql || d.name.toLowerCase().includes(ql) || d.short.toLowerCase().includes(ql)))
      .sort((a, b) => a.rarity - b.rarity || a.value - b.value);
    list.append(h('div', { class: 'mini', style: { margin: '2px 0 4px' } }, `${shown.length} 件`));
    for (const d of shown) list.append(row(d));
  };
  el.append(
    h('div', { class: 'panel', style: { marginBottom: '8px' } },
      h('div', { class: 'panel-h' }, '取り寄せ', h('span', { class: 'sub' }, `素材はいつでも買える（相場の ${PF.IMPORT_MARKUP} 倍）`)),
      h('div', { class: 'panel-b mini', style: { lineHeight: 1.7 } }, 'クラフトやハイドアウト強化に使う素材、バーター品、機械パーツ、情報をすべて扱う。高いが確実に手に入る。買った物は倉庫に届く（✔ 印なし）。',
        h('div', { class: 'row', style: { marginTop: '6px' } }, search))),
    chips, list);
  renderChips(); renderList();
  return el;
}

let mode = 'auction';
export function buildMarketPage(onChange) {
  const page = h('div', { class: 'page' });
  const switcher = h('div', { class: 'row', style: { gap: '6px', marginBottom: '8px', flexWrap: 'wrap' } });
  const body = h('div', {});
  let auction = null;
  const show = () => {
    switcher.innerHTML = '';
    const tab = (key, label) => h('button', { class: 'btn' + (mode === key ? ' primary' : ''), onclick: () => { mode = key; show(); } }, label);
    switcher.append(tab('auction', 'オークション（入札・即決）'), tab('import', '取り寄せ（素材をいつでも購入）'));
    body.innerHTML = '';
    if (mode === 'auction') { auction = buildAuction(onChange); body.append(auction.el); } else { auction = null; body.append(buildImport(onChange)); }
  };
  show();
  page.append(switcher, body);
  return { el: page, tick: () => auction?.tick() };
}
