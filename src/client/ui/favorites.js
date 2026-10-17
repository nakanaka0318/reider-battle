// お気に入り装備：今の装備を登録し、あとで倉庫の物＋購入でまとめて編成する
import { h, modal, toast, confirmBox, fmt } from './dom.js';
import { ITEMS } from '../../shared/items.js';
import * as PF from '../profile.js';

const SLOT_NAMES = { primary: 'メイン', secondary: 'サブ', holster: 'ピストル', helmet: 'ヘルメット', armor: 'アーマー', rig: 'リグ', backpack: 'バックパック', secure: 'セキュア' };

// 同じ名前をまとめて「名前 ×2」にする
function countNames(list) {
  const m = new Map();
  for (const n of list) m.set(n, (m.get(n) || 0) + 1);
  return [...m].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n));
}

export function favoritesModal(onChange) {
  const body = h('div', { style: { width: 'min(560px, 88vw)' } });
  let m = null;
  const render = () => {
    body.innerHTML = '';
    const P = PF.profile();
    const list = PF.listFavorites();
    body.append(h('div', { class: 'mini', style: { marginBottom: '8px' } },
      `お気に入りはこの端末に保存され、別のプレイヤーや最初からやり直した後でも使えます（最大 ${PF.FAV_MAX} 個）。`));
    if (!list.length) body.append(h('div', { class: 'mini', style: { padding: '10px', textAlign: 'center', border: '1px dashed var(--line)' } }, 'まだ登録されていません。'));
    list.forEach((fav, i) => {
      const plan = PF.favoritePlan(fav);
      const gear = Object.entries(fav.equip).filter(([s]) => s !== 'secure').map(([s, sp]) => `${SLOT_NAMES[s]}：${ITEMS[sp.id]?.short || ITEMS[sp.id]?.name || sp.id}`);
      const ok = !plan.missing.length;
      body.append(h('div', { style: { padding: '8px', border: '1px solid var(--line)', marginBottom: '6px', background: '#15181a' } },
        h('div', { class: 'row' },
          h('b', { class: 'grow' }, '★ ' + fav.name),
          h('span', { class: 'mini' }, new Date(fav.t).toLocaleString('ja-JP'))),
        h('div', { class: 'mini', style: { margin: '4px 0', lineHeight: 1.6 } }, gear.join(' ・ ') || '装備なし', ` ・ 中身 ${fav.contents.length} 個`),
        h('div', { class: 'mini', style: { color: ok ? '#8ad070' : '#d2a03a' } },
          plan.spent ? `購入費用 ${fmt(plan.spent)} C（所持金 ${fmt(P.money)} C）` : '倉庫の物だけでそろう（購入なし）',
          ok ? '' : ` ・ そろわない物 ${plan.missing.length} 種：${plan.missing.slice(0, 4).map((x) => `${x.name}（${x.why}）`).join('、')}${plan.missing.length > 4 ? ' ほか' : ''}`),
        h('div', { class: 'row', style: { gap: '6px', marginTop: '6px', flexWrap: 'wrap' } },
          h('button', { class: 'btn small primary', onclick: () => {
            const r = PF.applyFavorite(fav);
            m.close(); onChange?.();
            showResult(fav, r);
          } }, plan.spent ? '一括購入して装備' : 'この装備にする'),
          h('button', { class: 'btn small', onclick: async () => {
            if (!(await confirmBox('上書き登録', `「${fav.name}」を今の装備で上書きします。`, '上書き'))) return;
            PF.saveFavorite(fav.name, i); toast(`「${fav.name}」を上書きした`, 'good'); render();
          } }, '今の装備で上書き'),
          h('button', { class: 'btn small danger', onclick: async () => {
            if (!(await confirmBox('お気に入りを削除', `「${fav.name}」を削除します。`, '削除'))) return;
            PF.deleteFavorite(i); render();
          } }, '削除'))));
    });
    // 登録
    const lo = P.loadout.equip;
    const hasGear = Object.entries(lo).some(([s, v]) => v && s !== 'secure');
    const nameIn = h('input', { class: 'search', placeholder: `お気に入り ${list.length + 1}`, maxlength: 20, style: { flex: 1, padding: '8px' } });
    const add = () => {
      if (!hasGear) { toast('装備していないので登録できない', 'warn'); return; }
      if (list.length >= PF.FAV_MAX) { toast(`最大 ${PF.FAV_MAX} 個まで。どれかを削除するか上書きしてください`, 'warn'); return; }
      const n = nameIn.value.trim() || `お気に入り ${list.length + 1}`;
      PF.saveFavorite(n);
      toast(`今の装備を「${n}」として登録した`, 'good');
      render();
    };
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    body.append(h('div', { class: 'sep' }),
      h('b', {}, '今の装備をお気に入りに登録'),
      h('div', { class: 'mini', style: { margin: '4px 0' } }, '装備スロット・武器のパーツと弾の種類・リグ／バックパック／ポケットの中身を覚えます（セキュアコンテナの中身は除く）。'),
      h('div', { class: 'row' }, nameIn, h('button', { class: 'btn primary', onclick: add }, '★ 登録')));
  };
  render();
  m = modal('お気に入り装備', body, [{ text: '閉じる' }]);
}

function showResult(fav, r) {
  const got = countNames(r.bought);
  const lines = [
    h('div', {}, r.spent ? `${fmt(r.spent)} C で購入した。` : '購入はなし。'),
    got.length ? h('div', { class: 'mini', style: { margin: '4px 0' } }, '購入：' + got.join('、')) : null,
    r.fromStash.length ? h('div', { class: 'mini', style: { margin: '4px 0' } }, '倉庫から：' + countNames(r.fromStash).join('、')) : null,
    r.missing.length
      ? h('div', { style: { marginTop: '8px', color: '#d2a03a' } }, 'そろわなかった物：', h('ul', { style: { margin: '4px 0', paddingLeft: '18px' } }, r.missing.map((x) => h('li', { class: 'mini' }, `${x.name}（${x.why}）`))))
      : h('div', { style: { marginTop: '8px', color: '#8ad070' } }, 'すべてそろった。'),
  ];
  modal(`★ ${fav.name}`, h('div', { style: { maxWidth: '480px', lineHeight: 1.6 } }, lines), [{ text: 'OK' }]);
}
