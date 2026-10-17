// エントリポイント：タイトル → メニュー → レイド → 結果
import { h, toast, modal, fmt } from './ui/dom.js';
import { Menu } from './ui/menu.js';
import * as PF from './profile.js';
import { ITEMS } from '../shared/items.js';
import { allItems } from '../shared/inventory.js';

const app = document.getElementById('app');
let menu = null;

function clear() { if (menu) { menu.destroy(); menu = null; } app.innerHTML = ''; }

function titleScreen() {
  clear();
  const P = PF.loadProfile();
  // レイド中にページを閉じた場合は MIA 扱い
  if (P?.inRaid) {
    const sec = P.inRaid.secure;
    delete P.inRaid;
    PF.applyRaidResult({ survived: false, mia: true, killer: 'レイド離脱', secure: sec, stats: {} });
    setTimeout(() => toast('前回のレイドを途中で離脱したため、装備を失った（MIA）', 'warn'), 300);
  }
  const cv = h('canvas', { class: 'bgfx' });
  const nameIn = h('input', { placeholder: 'コールサインを入力', maxlength: 16, value: P?.name || '' });
  const start = () => {
    if (!PF.profile()) {
      const n = nameIn.value.trim() || 'レイダー';
      PF.newProfile(n);
      toast(`ようこそ、${n}。初期装備を倉庫に用意した。`, 'good');
    }
    showMenu();
  };
  const scr = h('div', { class: 'title-screen' }, cv,
    h('div', { class: 'logo' }, 'RAIDER', h('br'), h('span', {}, 'BATTLE')),
    h('div', { class: 'logo-sub' }, 'EXTRACTION SHOOTER ・ グレイヴ港湾区'),
    h('div', { class: 'title-menu' },
      P ? h('div', { style: { color: '#bbb', fontSize: '14px' } }, `おかえり、${P.name}（レベル ${PF.level()}・${fmt(P.money)} C）`) : nameIn,
      h('button', { class: 'btn primary big', onclick: start }, P ? '続ける' : 'はじめる'),
      h('button', { class: 'btn', onclick: () => showHelp() }, '遊び方'),
    ),
    h('div', { class: 'title-foot' }, '© RAIDER BATTLE — WebGL / three.js ・ 全てのグラフィックとサウンドはプロシージャル生成'),
  );
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
  app.append(scr);
  animateTitle(cv);
}

function animateTitle(cv) {
  const g = cv.getContext('2d');
  const parts = [];
  const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
  resize();
  const tick = () => {
    if (!cv.isConnected) return;
    requestAnimationFrame(tick);
    if (parts.length < 120) parts.push({ x: Math.random() * cv.width, y: cv.height + 10, vy: 0.3 + Math.random() * 1.2, s: 1 + Math.random() * 2.5, a: Math.random() });
    g.clearRect(0, 0, cv.width, cv.height);
    for (const p of parts) {
      p.y -= p.vy; p.x += Math.sin(p.y / 60) * 0.3;
      if (p.y < -10) { p.y = cv.height + 10; p.x = Math.random() * cv.width; }
      g.fillStyle = `rgba(230,170,70,${0.25 + p.a * 0.5})`;
      g.fillRect(p.x, p.y, p.s, p.s);
    }
  };
  tick();
}

function showHelp() {
  modal('遊び方', h('div', { style: { maxWidth: '620px', lineHeight: 1.75, fontSize: '14px' } },
    h('p', {}, '装備を整えて「グレイヴ港湾区」へ出撃し、物資を漁って脱出地点から生還するエクストラクション・シューターです。'),
    h('p', {}, '■ レイド中に死亡すると、持ち込んだ装備と拾ったアイテムをすべて失います（セキュアコンテナの中身は残る）。'),
    h('p', {}, '■ マップには「スカブ」（現地の武装民）、「ARC 機械」（ドローンやセンチネル）、そして他のレイダーがいます。オールNPC モードでは他のレイダーも AI です。'),
    h('p', {}, '■ 持ち帰ったアイテムはトレーダーに売却したり、ハイドアウトでクラフトの材料にしたり、タスクの納品に使えます。'),
    h('p', {}, '■ 体には部位ごとの HP があり、頭か胸の HP が 0 になると死亡します。出血・骨折は医薬品で治療しましょう。'),
    h('p', {}, '■ アーマーにはクラス（1〜6）があり、弾の貫通力が高いほど貫通しやすくなります。'),
  ), [{ text: '閉じる' }]);
}

function showMenu() {
  clear();
  menu = new Menu(app, { onDeploy: deploy, onSettings: settingsModal });
}

function settingsModal() {
  const P = PF.profile();
  const S = P.settings;
  const row = (label, input) => h('div', { class: 'slider-row' }, label, input, h('span'));
  const range = (key, min, max, step) => {
    const v = h('span', { class: 'num' }, S[key]);
    const el = h('div', { class: 'slider-row' }, { sens: 'マウス感度', adsSensMul: 'ADS 感度倍率', fov: '視野角', volume: '音量', touchSens: 'タッチ感度' }[key],
      h('input', { type: 'range', min, max, step, value: S[key], oninput: (e) => { S[key] = parseFloat(e.target.value); v.textContent = S[key]; PF.save(); } }), v);
    return el;
  };
  const qual = h('select', { onchange: (e) => { S.quality = e.target.value; PF.save(); } },
    ['high', 'medium', 'low'].map((q) => h('option', { value: q, selected: S.quality === q }, { high: '高（影・ブルーム・草）', medium: '中', low: '低（影なし）' }[q])));
  modal('設定', h('div', { style: { width: '460px' } },
    matchMedia('(pointer: coarse)').matches ? range('touchSens', 0.2, 3, 0.05) : range('sens', 0.2, 3, 0.05), range('adsSensMul', 0.3, 1.5, 0.05), range('fov', 60, 100, 1), range('volume', 0, 1, 0.05),
    row('画質', qual),
    h('label', { class: 'row mini', style: { margin: '6px 0' } }, h('input', { type: 'checkbox', checked: !!S.invertY, onchange: (e) => { S.invertY = e.target.checked; PF.save(); } }), 'マウス Y 軸反転'),
    h('label', { class: 'row mini', style: { margin: '6px 0' } }, h('input', { type: 'checkbox', checked: !!S.showFps, onchange: (e) => { S.showFps = e.target.checked; PF.save(); } }), 'FPS・PING を表示'),
  ), [{ text: '閉じる' }]);
}

async function deploy(opts) {
  const P = PF.profile();
  const lo = P.loadout;
  if (!lo.equip.primary && !lo.equip.secondary && !lo.equip.holster) {
    if (!confirm('武器を持たずに出撃しますか？')) return;
  }
  const loadout = PF.prepareRaidLoadout();
  P.inRaid = { t: Date.now(), secure: lo.equip.secure ? JSON.parse(JSON.stringify(lo.equip.secure)) : null };
  PF.save();
  clear();
  const { Game } = await import('./game/game.js');
  const game = new Game(app, {
    profile: P,
    opts: { ...opts, loadout, level: PF.level() },
    onEnd: (res) => showResult(res),
  });
  try {
    await game.start();
  } catch (e) {
    console.error(e);
    toast(e.message || 'レイドを開始できませんでした', 'warn');
    delete P.inRaid; PF.save();
    showMenu();
  }
}

function showResult(res) {
  clear();
  const P = PF.profile();
  const before = PF.itemsValue(P.loadout);
  delete P.inRaid;
  const r = PF.applyRaidResult(res);
  const st = res.stats || {};
  const ok = res.survived;
  const title = ok ? '生 還' : res.mia ? 'M I A' : '死 亡';
  const lootList = ok ? allItems(res.inv || { equip: {} }).filter((i) => i.fir).slice(0, 40) : [];
  const box = h('div', { class: 'result' }, h('div', { class: 'result-box' },
    h('h1', { class: ok ? 'ok' : 'dead' }, title),
    h('div', { class: 'sub' }, ok ? `「${res.exName}」から脱出した` : res.mia ? '制限時間内に脱出できなかった' : `${res.killer || '不明'} に倒された${res.weapon ? `（${res.weapon}）` : ''}`),
    h('div', { class: 'stats' },
      h('div', { class: 'st' }, h('b', {}, st.kills || 0), h('small', {}, 'キル')),
      h('div', { class: 'st' }, h('b', {}, Math.round(st.damage || 0)), h('small', {}, '与ダメージ')),
      h('div', { class: 'st' }, h('b', { style: { color: r.gained >= 0 ? '#8ad070' : '#d24a3a' } }, (r.gained >= 0 ? '+' : '') + fmt(r.gained)), h('small', {}, '装備価値の増減 (C)')),
      h('div', { class: 'st' }, h('b', {}, '+' + fmt(r.xp)), h('small', {}, '獲得 XP')),
    ),
    st.shots ? h('div', { class: 'mini', style: { textAlign: 'center' } }, `射撃 ${st.shots} 発 ・ 命中 ${st.hits || 0}（${Math.round(((st.hits || 0) / st.shots) * 100)}%） ・ スカブ ${st.scavKills || 0} ・ レイダー ${st.pmcKills || 0} ・ ARC ${st.machineKills || 0}`) : null,
    r.deposited ? h('div', { class: 'mini', style: { textAlign: 'center', color: '#e8c26a', marginTop: '6px' } }, `持ち帰ったクレジット ${fmt(r.deposited)} C を入金した`) : null,
    r.levelUp ? h('div', { style: { textAlign: 'center', color: '#e8c26a', fontSize: '20px', margin: '10px 0', fontWeight: 700 } }, `レベルアップ！ → レベル ${PF.level()}`) : null,
    lootList.length ? h('div', { class: 'panel', style: { marginTop: '12px' } }, h('div', { class: 'panel-h' }, 'レイド内で入手したアイテム'), h('div', { class: 'panel-b', style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } }, lootList.map((i) => h('span', { class: 'tag', style: { fontSize: '12px' } }, ITEMS[i.id].name + (i.count > 1 ? ` ×${i.count}` : ''))))) : null,
    !ok && res.secure ? h('div', { class: 'mini', style: { textAlign: 'center', marginTop: '8px' } }, 'セキュアコンテナの中身は無事だった。') : null,
    h('div', { style: { textAlign: 'center', marginTop: '20px' } }, h('button', { class: 'btn primary big', onclick: showMenu }, 'ハイドアウトへ戻る')),
  ));
  void before;
  app.append(box);
}

// ブラウザの戻る・リロードで進行が消えないよう保存
addEventListener('beforeunload', () => PF.save());
titleScreen();
