// アイテムのツールチップ内容
import { h, fmt } from './dom.js';
import { ITEMS, CAT_NAMES, RARITY_NAMES, RARITY_COLORS, CALIBERS, weaponStats, itemValue, itemWeight, ammoForCaliber } from '../../shared/items.js';
import { PART_NAMES } from '../../shared/combat.js';

const CLASS_NAMES = { pistol: 'ハンドガン', smg: 'サブマシンガン', rifle: 'アサルトライフル', dmr: 'マークスマンライフル', sniper: 'ボルトアクション', shotgun: 'ショットガン', lmg: '軽機関銃' };
const MODE_NAMES = { semi: '単射', burst: '3点', auto: '連射' };
const SLOT_JP = { sight: 'サイト', muzzle: 'マズル', grip: 'グリップ', stock: 'ストック', tactical: 'タクティカル', mag: 'マガジン' };
export { CLASS_NAMES, MODE_NAMES, SLOT_JP };

export function itemTooltip(item, extra = {}) {
  const def = ITEMS[item.id];
  const rows = [];
  const row = (k, v) => rows.push(h('tr', {}, h('td', {}, k), h('td', {}, v)));
  if (def.weapon) {
    const st = weaponStats(item);
    row('分類', CLASS_NAMES[def.weapon.class]);
    row('口径', CALIBERS[def.weapon.caliber].name);
    row('連射速度', st.rpm + ' RPM');
    row('射撃モード', def.weapon.modes.map((m) => MODE_NAMES[m]).join(' / '));
    row('装弾数', `${item.mag?.count ?? 0} / ${st.capacity}`);
    if (item.mag?.count) row('装填弾', ITEMS[item.mag.ammo]?.short || '');
    row('縦反動', Math.round(st.recoilV * 100));
    row('横反動', Math.round(st.recoilH * 100));
    row('エルゴノミクス', Math.round(st.ergo));
    if (st.zoom > 1.5) row('照準倍率', st.zoom + 'x');
    if (st.suppressed) row('消音', 'あり');
    const mods = Object.entries(item.mods || {}).filter(([, m]) => m);
    if (mods.length) row('MOD', mods.map(([, m]) => ITEMS[m.id].short).join(', '));
  }
  if (def.ammo) {
    row('口径', CALIBERS[def.ammo.caliber].name);
    row('ダメージ', def.ammo.damage + (def.ammo.pellets > 1 ? ` × ${def.ammo.pellets}` : ''));
    row('貫通力', def.ammo.pen);
    row('防具ダメージ', Math.round(def.ammo.armorDmg * 100) + '%');
    if (def.ammo.tracer) row('曳光弾', 'はい');
  }
  if (def.mod) {
    const m = def.mod;
    row('スロット', SLOT_JP[m.slot]);
    if (m.zoom) row('倍率', m.zoom + 'x');
    if (m.recoil) row('反動', '-' + Math.round(m.recoil * 100) + '%');
    if (m.ergo) row('エルゴ', (m.ergo > 0 ? '+' : '') + m.ergo);
    if (m.magBonus) row('装弾数', '+' + m.magBonus);
    if (m.suppressor) row('消音', 'あり');
    if (m.thermal) row('サーマル', 'あり');
    if (m.nv) row('暗視', 'あり');
    if (m.calibers) row('対応口径', m.calibers.map((c) => CALIBERS[c].name).join(', '));
  }
  if (def.armor) {
    row('防護クラス', def.armor.cls);
    rows.push(h('tr', {}, h('td', {}, '耐久度'), h('td', {}, `${Math.round(item.dur ?? def.armor.dur)} / ${def.armor.dur}`)));
    rows.push(h('tr', {}, h('td', { colspan: 2 }, h('div', { class: 'bar' }, h('i', { style: { width: ((item.dur ?? def.armor.dur) / def.armor.dur * 100) + '%', background: '#8ab0d0' } })))));
    row('防護部位', def.armor.zones.map((z) => PART_NAMES[z]).join('・'));
    row('素材', { aramid: 'アラミド', uhmwpe: 'UHMWPE', steel: '鋼鉄', titan: 'チタン', ceramic: 'セラミック' }[def.armor.mat] || def.armor.mat);
    if (def.armor.speed) row('移動速度', '-' + Math.round(def.armor.speed * 100) + '%');
  }
  if (def.grids) row('容量', def.grids.map(([w, hh]) => `${w}×${hh}`).join(' + ') + ` (${def.grids.reduce((s, [w, hh]) => s + w * hh, 0)})`);
  if (def.med) {
    const m = def.med;
    if (m.heal) row('回復量', m.heal + ' HP');
    if (m.bleed) row('軽出血', '治療');
    if (m.heavy) row('重出血', '治療');
    if (m.fracture) row('骨折', '治療');
    if (m.restore) row('部位修復', 'あり');
    if (m.pain) row('鎮痛', m.pain + ' 秒');
    if (m.energy) row('エネルギー', (m.energy > 0 ? '+' : '') + m.energy);
    if (m.hydration) row('水分', (m.hydration > 0 ? '+' : '') + m.hydration);
    if (m.stim) row('効果時間', m.stim.dur + ' 秒');
    row('使用時間', m.use + ' 秒');
    if (m.uses > 1) row('残り使用回数', `${item.uses ?? m.uses} / ${m.uses}`);
  }
  if (def.grenade) { row('信管', def.grenade.fuse + ' 秒'); row('効果範囲', def.grenade.radius + ' m'); }
  if (def.key) row('対応', def.sub === 'keycard' ? 'キーカード' : '鍵');
  if (def.carry) row('耐荷重', `+${def.carry} kg（持っているだけで有効）`);
  const val = itemValue(item);
  return h('div', {},
    h('div', { class: 'tt-name', style: { color: RARITY_COLORS[def.rarity] } }, def.name),
    h('div', { class: 'tt-cat' }, `${CAT_NAMES[def.cat] || def.cat} ・ ${RARITY_NAMES[def.rarity]}${item.fir ? ' ・ レイド内入手' : ''}`),
    def.desc ? h('div', { class: 'tt-desc' }, def.desc) : null,
    rows.length ? h('table', {}, rows) : null,
    h('div', { class: 'sep' }),
    h('div', { class: 'row' }, h('span', { class: 'mini' }, `${itemWeight(item).toFixed(2)} kg ・ ${def.w}×${def.h}`), h('span', { class: 'grow' }), h('span', { class: 'tt-val' }, fmt(val) + ' C')),
    extra.price ? h('div', { class: 'row', style: { marginTop: '4px' } }, h('span', { class: 'mini' }, extra.priceLabel || '売却'), h('span', { class: 'grow' }), h('span', { class: 'tt-val' }, fmt(extra.price) + ' C')) : null,
    def.weapon ? h('div', { class: 'mini', style: { marginTop: '4px' } }, '対応弾: ' + ammoForCaliber(def.weapon.caliber).map((a) => a.short).join(' / ')) : null,
    extra.hint ? h('div', { class: 'mini', style: { marginTop: '6px', color: '#8a8' } }, extra.hint) : null,
  );
}
