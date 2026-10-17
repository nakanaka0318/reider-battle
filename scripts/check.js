// データ整合性チェックとヘッドレスのレイドシミュレーション
import { ITEMS, ITEM_LIST, CONTAINERS } from '../src/shared/items.js';
import { RECIPES, QUESTS, STATIONS, TRADERS } from '../src/shared/data/meta.js';
import { Raid, TICK } from '../src/shared/raid.js';

let errors = 0;
const err = (m) => { errors++; console.error('✗', m); };
for (const r of RECIPES) for (const [id] of [...r.in, ...r.out]) if (!ITEMS[id]) err(`recipe ${r.id}: unknown item ${id}`);
for (const [sid, S] of Object.entries(STATIONS)) for (const lv of S.costs) for (const [id] of lv) if (!ITEMS[id]) err(`station ${sid}: unknown item ${id}`);
for (const q of QUESTS) {
  for (const o of q.obj) if (o.item && !ITEMS[o.item]) err(`quest ${q.id}: unknown item ${o.item}`);
  for (const [id] of q.reward.items || []) if (!ITEMS[id]) err(`quest ${q.id}: unknown reward ${id}`);
  for (const r of q.req || []) if (!QUESTS.find((x) => x.id === r)) err(`quest ${q.id}: unknown req ${r}`);
  if (!TRADERS.find((t) => t.id === q.trader)) err(`quest ${q.id}: unknown trader`);
}
for (const it of ITEM_LIST) {
  if (it.weapon && !ITEMS[it.weapon.defaultAmmo]) err(`weapon ${it.id}: bad default ammo`);
  if (!it.w || !it.h) err(`item ${it.id}: no size`);
}
console.log(`アイテム ${ITEM_LIST.length} 種 / レシピ ${RECIPES.length} / タスク ${QUESTS.length} / コンテナ種別 ${Object.keys(CONTAINERS).length}`);

// 5 分間のシミュレーション
const raid = new Raid({ mode: 'offline', raiders: 9, duration: 1800 });
raid.addClient('t', { name: 'test' }, () => {});
const t0 = Date.now();
for (let i = 0; i < 30 * 300; i++) { raid.tick(TICK); if (i % 2 === 0) raid.flush(); }
console.log(`シミュレーション 5 分: ${Date.now() - t0}ms, キル ${raid.feed.length}`);
if (errors) { console.error(`${errors} 件のエラー`); process.exit(1); }
console.log('OK');
