// 攻略ヒント：高価なアイテムの取り方・場所・鍵・稼ぎ方
import { h, fmt, showTooltip, moveTooltip, hideTooltip } from './dom.js';
import { itemTooltip } from './itemtip.js';
import { ITEM_LIST, ITEMS, RARITY_COLORS, CAT_NAMES, createItem } from '../../shared/items.js';
import { TRADERS, traderBuyRate } from '../../shared/data/meta.js';
import { getItemIcon } from '../icons.js';
import { getMap, drawMapPreview, mapHotspots, HOTSPOT_TYPES } from './mapview.js';

export const LOOT_PLACES = {
  industrial: '工場・港の倉庫・工具箱・木箱',
  tech: '研究所・無線塔・PC 本体',
  medical: '薬局・医療ケース・研究所の医療区画',
  residential: '住宅街・モーテル・ジャケット・引き出し',
  office: '事務所の机・ファイル棚・レジ',
  military: '軍事基地・武器ケース・弾薬箱・軍用コンテナ',
  food: '冷蔵庫・スーパー・ダイナー',
  valuable: '金庫・研究所の機密室・ボスの持ち物',
  machine: 'ARC 機械の残骸・ARC キャッシュ・墜落地点',
  junk: 'どこでも',
};

const TIPS = [
  ['高価な物の基本', [
    '金庫（マップの黄色）は貴重品・現金・鍵が出やすい。工場事務所、司令部 2 階、スーパー金庫室、ガソリンスタンド事務所、施錠された部屋の中にある。',
    '施錠された部屋（紫）は鍵が必要だが、金庫や武器ケースがまとめて置いてある。鍵はファイル棚・引き出し・ジャケット・死体から見つかる。下の「鍵とキーカード」を参照。',
    '研究所は最も危険で最も儲かる。2 階のレッド区画（レッドキーカード）には金庫・研究用ケース・ARC キャッシュが並ぶ。センチネルが守っているので背中の青いコアを狙うか、EMP グレネードを使う。',
    '軍事基地の司令官グロムは高級装備と貴重品を持ち、倒すと「武器庫の鍵」を落とす。護衛 2 人と一緒にいるので遠距離から 1 人ずつ。',
    '軍事基地の敷地内には補給物資（緑）がある。レア度の高い軍需品が出やすい。',
  ]],
  ['ARC 機械で稼ぐ', [
    'ワスプやホーネットを壊すと残骸から機械パーツが取れる。センチネル反応炉・量子プロセッサ・ハーベスターのコアなどは 1 個で数十万 C。',
    '機械は装甲が硬い。貫通力 40 以上の弾（BT・M855A1・BP など）か、EMP グレネードを使う。弱点のコア（光っている部分）は 1.6 倍ダメージ。',
    '機械パーツは技師ヤンに売ると 8 割で買い取ってくれる。ARC 研究台で ARC 兵器やエネルギーセルも作れる。',
    'ティック（脚の付いた球体）は近づくと自爆する。ピッという音が聞こえたらすぐ離れる。',
    '東の「ARC母艦 墜落跡」は高さ 46 m のアンテナが目印の巨大な残骸。貨物室・2 階の動力コア室・屋上に ARC キャッシュや金庫が多いが、重装の ARC 機械が守っている。外壁の破孔から入り、ホールの階段で 2 階、コア室の東から屋上へ上れる。',
  ]],
  ['持ち帰りの効率', [
    '1 マス当たりの価値が高い物（宝石・金貨・GPU・データ類）を優先して拾う。大きいガラクタは捨てても良い。',
    '一番大事な物はセキュアコンテナに入れる。死んでも中身は残る。',
    'ルカは貴重品を 78% で、ヤンは電子部品と機械パーツを 75〜80% で買い取る。倉庫の「まとめて売却」で、選んだ物をそれぞれ一番高く買う商人へ一度に売れる（納品に必要な ✔ アイテムは自動で残る）。',
    'レイド内で拾った物（✔ 印）はタスクの納品に使える。タスク報酬は高額。',
    '重量が耐荷重（22 kg）を超えると移動が遅くなる。反重力パッチ・モジュール・コアを持っていると耐荷重が増える（セキュアコンテナに入れておけば死んでも失わない）。ヤンが売っているほか、ARC 研究台で作れる。',
  ]],
  ['ハイドアウトで稼ぐ', [
    'マイニングラックに GPU を入れると、時間がたつと暗号コイン（15 万 C）ができる。GPU は消費しない。',
    'ワークベンチで金のチェーン・指輪・金貨から金インゴット（22 万 C）を作れる。',
    'クラフトで作った物はレイド内入手扱いになる。',
  ]],
  ['お金の使い道', [
    'ハイドアウトの「トレーニング」で耐荷重・スタミナ・反動・医薬品の使用時間を永続的に強化できる（死んでも消えない）。',
    '出撃画面で「保険」をかけると、死亡・未帰還のとき武器・防具・リグ・バックパックが 80% の確率で戻ってくる（装備価値の 12%）。',
    'オークションの「取り寄せ」では、素材・バーター品・機械パーツ・情報・貴重品をいつでも相場の 2.5 倍で買える。クラフトや強化の画面の「不足素材を購入」で足りない分だけまとめて買うこともできる。',
    'オークションの入札・即決では、トレーダーが扱わない鍵やキーカードも手に入る。',
  ]],
  ['生き残るコツ', [
    '足音は敵にも聞こえる。しゃがむと静か。夜は敵の視界が狭いので忍び込みやすいが、ライトを点けると見つかる。',
    '撃たれたら物陰で止血（包帯・止血帯）。重出血は止血帯でないと止まらない。H キー（スマホは ✚）で状態に合う医薬品を自動で使う。',
    '脱出地点は O キー（スマホは ⛳）で確認。工場の裏ゲートは制御室のスイッチ、車は 5,000 C、研究所エレベーターはブラックキーカードが必要。',
    '装備に迷ったら倉庫画面の「おまかせ装備」。予算を決めて自動購入もできる。',
  ]],
];

export function buildHintsPage() {
  const page = h('div', { class: 'page' });
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px', alignItems: 'start' } });
  // マップ
  const cv = h('canvas', { width: 640, height: 640, style: { width: '100%', height: 'auto', maxWidth: '520px', display: 'block', margin: '0 auto', border: '1px solid var(--line2)' } });
  const spots = mapHotspots();
  setTimeout(() => drawMapPreview(cv, { hotspots: spots }), 0);
  const legend = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '10px', marginTop: '8px', justifyContent: 'center' } },
    Object.entries(HOTSPOT_TYPES).map(([k, t]) => h('span', { class: 'mini', style: { display: 'flex', alignItems: 'center', gap: '4px' } },
      h('i', { style: { width: '9px', height: '9px', background: t.color, transform: 'rotate(45deg)', display: 'inline-block', border: '1px solid #000' } }), `${t.label}（${spots.filter((s) => s.type === k).length}）`)));
  grid.append(h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, '高価な物が出やすい場所'), h('div', { class: 'panel-b' }, cv, legend)));
  // テキストのヒント
  for (const [title, list] of TIPS) {
    grid.append(h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, title),
      h('div', { class: 'panel-b' }, h('ul', { style: { margin: 0, paddingLeft: '18px', lineHeight: 1.75, fontSize: '13px' } }, list.map((t) => h('li', {}, t))))));
  }
  // 1 マス当たりの価値が高いアイテム
  const top = ITEM_LIST.filter((d) => ['valuable', 'barter', 'machine', 'intel'].includes(d.cat))
    .map((d) => ({ d, per: d.value / (d.w * d.h) })).sort((a, b) => b.per - a.per).slice(0, 15);
  const row = (d, right, sub) => {
    const el = h('div', { class: 'shop-row', style: { gridTemplateColumns: '44px 1fr auto' } },
      h('i', { class: 'ic', style: { width: '44px', height: '34px', backgroundImage: `url(${getItemIcon(d)})` } }),
      h('span', { class: 'nm', style: { color: RARITY_COLORS[d.rarity] } }, d.name, h('small', {}, sub)),
      h('span', { class: 'pr' }, right));
    el.addEventListener('mouseenter', (e) => showTooltip(itemTooltip(createItem(d.id), {}), e.clientX, e.clientY));
    el.addEventListener('mousemove', (e) => moveTooltip(e.clientX, e.clientY));
    el.addEventListener('mouseleave', hideTooltip);
    return el;
  };
  const bestSell = (d) => { let best = null, r = 0; for (const t of TRADERS) { const x = traderBuyRate(t, d); if (x > r) { r = x; best = t; } } return best ? `${best.name}が ${Math.round(r * 100)}%` : ''; };
  grid.append(h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, '1 マス当たりの価値が高いアイテム', h('span', { class: 'sub' }, '価値 / マス')),
    h('div', { class: 'panel-b col', style: { gap: '2px' } }, top.map(({ d, per }) => row(d, fmt(per) + ' C', `${CAT_NAMES[d.cat]} ・ ${d.w}×${d.h} ・ ${d.loot.map((t) => LOOT_PLACES[t]).filter(Boolean)[0] || ''} ・ 売却：${bestSell(d)}`)))));
  // 鍵
  const M = getMap();
  const keys = ITEM_LIST.filter((d) => d.cat === 'key');
  grid.append(h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, '鍵とキーカード', h('span', { class: 'sub' }, '開く部屋・見つかる場所')),
    h('div', { class: 'panel-b col', style: { gap: '2px' } }, keys.map((d) => {
      const door = M.doors.find((x) => x.locked === d.key.door);
      const ex = M.extracts.find((x) => x.key === d.id);
      const opens = door ? door.name : ex ? `${ex.name}（脱出）` : '';
      return row(d, fmt(d.value) + ' C', `${opens} ・ ${d.loot.map((t) => LOOT_PLACES[t]).filter(Boolean).join(' / ')}`);
    }))));
  page.append(grid);
  return page;
}
void ITEMS;
