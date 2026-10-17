// プレイヤー（セーブデータ）の切り替え・新規作成・やり直し
import { h, modal, toast, confirmBox, fmt } from './dom.js';
import * as PF from '../profile.js';

export function playersModal(onChange) {
  const body = h('div', { style: { width: 'min(520px, 86vw)' } });
  let m = null;
  const render = () => {
    body.innerHTML = '';
    const cur = PF.currentId();
    const list = PF.listProfiles();
    body.append(h('div', { class: 'mini', style: { marginBottom: '6px' } }, 'セーブデータはプレイヤーごとに別々に保存されます。'));
    for (const p of list) {
      const isCur = p.id === cur && PF.profile();
      body.append(h('div', { class: 'row', style: { padding: '8px', border: '1px solid var(--line)', marginBottom: '4px', background: isCur ? '#24211a' : '#15181a', borderColor: isCur ? 'var(--accent)' : '' } },
        h('div', { class: 'grow' },
          h('b', {}, p.name), isCur ? h('span', { class: 'tag', style: { marginLeft: '6px' } }, 'プレイ中') : null,
          h('div', { class: 'mini' }, `レベル ${p.level} ・ ${fmt(p.money)} C ・ レイド ${p.raids} 回 ・ ${new Date(p.updated).toLocaleString('ja-JP')}`)),
        isCur ? null : h('button', { class: 'btn small primary', onclick: () => { PF.switchProfile(p.id); toast(`${p.name} に切り替えた`, 'good'); m.close(); onChange(); } }, '切り替え'),
        h('button', { class: 'btn small danger', onclick: async () => {
          if (!(await confirmBox('プレイヤーを削除', `「${p.name}」のセーブデータを削除します。元に戻せません。`, '削除'))) return;
          PF.deleteProfile(p.id);
          toast(`${p.name} を削除した`);
          if (isCur) { m.close(); onChange(); } else render();
        } }, '削除'),
      ));
    }
    const nameIn = h('input', { class: 'search', placeholder: '新しいコールサイン', maxlength: 16, style: { flex: 1, padding: '8px' } });
    const create = () => {
      const n = nameIn.value.trim() || 'レイダー';
      PF.save();
      PF.newProfile(n);
      toast(`新しいプレイヤー「${n}」で最初から始めます`, 'good');
      m.close(); onChange();
    };
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
    body.append(h('div', { class: 'sep' }),
      h('b', {}, '新しいプレイヤーで最初から始める'),
      h('div', { class: 'mini', style: { margin: '4px 0' } }, '今のプレイヤーのデータは残ります。あとで切り替えて続きを遊べます。'),
      h('div', { class: 'row' }, nameIn, h('button', { class: 'btn primary', onclick: create }, '始める')));
    if (PF.profile()) {
      const P = PF.profile();
      body.append(h('div', { class: 'sep' }),
        h('button', { class: 'btn danger', style: { width: '100%' }, onclick: async () => {
          if (!(await confirmBox('最初からやり直す', `「${P.name}」の倉庫・お金・レベル・タスクをすべて消して、同じ名前で最初からやり直します。`, 'やり直す'))) return;
          const name = P.name;
          PF.resetProfile();
          PF.newProfile(name);
          toast('最初からやり直した', 'good');
          m.close(); onChange();
        } }, `「${P.name}」を最初からやり直す`));
    }
  };
  render();
  m = modal('プレイヤー', body, [{ text: '閉じる' }]);
}
